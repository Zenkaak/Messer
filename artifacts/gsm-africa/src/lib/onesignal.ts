type OneSignalClient = {
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications?: {
    requestPermission: () => Promise<boolean>;
  };
  User?: {
    PushSubscription?: {
      optIn: () => Promise<void>;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalClient) => void | Promise<void>>;
  }
}

export function syncOneSignalUser(externalId: string | number | null): void {
  if (
    typeof window === "undefined" ||
    !window.OneSignalDeferred
  ) return;
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      if (externalId === null) {
        await OneSignal.logout();
        return;
      }
      await OneSignal.login(String(externalId));
    } catch {
      // Push registration is best-effort and must not affect authentication.
    }
  });
}

/**
 * Enable push from a real user gesture (call request or admin login).
 * OneSignal cannot reliably open its permission prompt from a background
 * effect, so callers should invoke this from an interaction that starts a
 * call or signs the admin in.
 */
export function enableOneSignalPush(externalId: string | number): Promise<boolean> {
  if (typeof window === "undefined" || !window.OneSignalDeferred) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish(false), 10000);
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.login(String(externalId));
      if (OneSignal.Notifications?.requestPermission) {
        const permissionGranted = await OneSignal.Notifications.requestPermission();
        if (!permissionGranted) {
          window.clearTimeout(timeout);
          finish(false);
          return;
        }
      }
      await OneSignal.User?.PushSubscription?.optIn?.();
      window.clearTimeout(timeout);
      finish(true);
    } catch {
      // Push registration is best-effort and must not block a call.
      window.clearTimeout(timeout);
      finish(false);
    }
  });
  });
}