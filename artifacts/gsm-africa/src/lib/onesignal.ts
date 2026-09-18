type OneSignalClient = {
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalClient) => void | Promise<void>>;
  }
}

export function syncOneSignalUser(userId: number | null): void {
  if (
    typeof window === "undefined" ||
    window.location.hostname !== "unlockgsm.vercel.app" ||
    !window.OneSignalDeferred
  ) return;
  window.OneSignalDeferred.push(async (OneSignal) => {
    if (userId === null) {
      await OneSignal.logout();
      return;
    }
    await OneSignal.login(String(userId));
  });
}