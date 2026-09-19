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
export function enableOneSignalPush(externalId: string | number): void {
  if (typeof window === "undefined" || !window.OneSignalDeferred) return;
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.login(String(externalId));
      if (OneSignal.Notifications?.requestPermission) {
        await OneSignal.Notifications.requestPermission();
      }
      await OneSignal.User?.PushSubscription?.optIn?.();
    } catch {
      // Push registration is best-effort and must not block a call.
    }
  });
}