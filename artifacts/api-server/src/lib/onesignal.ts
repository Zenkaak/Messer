import { logger } from "./logger";
import { getOneSignalCredentials } from "./admin-settings";

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

interface OneSignalCallPushInput {
  externalId: string | number;
  callId: number;
  heading?: string;
  body?: string;
}

export async function sendIncomingCallPush({
  externalId,
  callId,
  heading = "Incoming GSM WORLD call",
  body = "GSM UNLOCK is calling you. Tap to answer.",
}: OneSignalCallPushInput): Promise<void> {
  const { appId, apiKey } = await getOneSignalCredentials();
  if (!apiKey) {
    logger.warn({ externalId, callId }, "OneSignal push skipped: REST API key is not configured");
    return;
  }

  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: "push",
        include_aliases: { external_id: [String(externalId)] },
        headings: { en: heading },
        contents: { en: body },
        url: `${process.env.PUBLIC_APP_URL || "https://unlockgsm.vercel.app"}/?call=${callId}`,
        web_url: `${process.env.PUBLIC_APP_URL || "https://unlockgsm.vercel.app"}/?call=${callId}`,
        ttl: 120,
        priority: 10,
        collapse_id: `gsm-call-${callId}`,
        chrome_web_icon: `${process.env.PUBLIC_APP_URL || "https://unlockgsm.vercel.app"}/favicon.svg`,
        chrome_web_badge: `${process.env.PUBLIC_APP_URL || "https://unlockgsm.vercel.app"}/favicon.svg`,
        web_push_topic: `gsm-call-${callId}`,
        data: { callId, type: "incoming_call" },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.warn({ externalId, callId, status: response.status, body: body.slice(0, 500) }, "OneSignal call push failed");
    }
  } catch (err) {
    logger.warn({ err, externalId, callId }, "OneSignal call push request failed");
  }
}