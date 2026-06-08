/**
 * Daily marketing broadcast — AI-generates a fresh email each day and sends
 * it to every active user.  Called by:
 *   • Vercel cron  → POST /api/admin/cron/daily-marketing
 *   • self-hosted  → minute-ticker in index.ts fires at 3:50 AM EAT
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendEmail, announcementEmail } from "./email";
import { getOpenAiKey, getOpenAiBaseUrl, getWorkingCascade } from "./admin-settings";

// Rotating daily prompts — keeps the emails varied throughout the week.
const DAILY_PROMPTS = [
  "Weekly deals and discounts on phone unlocking tools and GSM services. Highlight the value of using professional tools.",
  "New stock arrivals and featured products at GSM World. Encourage customers to check out the latest listings.",
  "Reminder about our fast and reliable phone unlocking services. Mention customer satisfaction and turnaround time.",
  "Tips for phone technicians — how GSM World tools help grow their business. Include a call to action to browse products.",
  "Special weekend promotion on selected GSM tools and unlock credits. Create urgency with limited availability.",
  "Customer success stories and how our products solve real problems. Invite customers to place an order today.",
  "GSM World loyalty reminder — top up your wallet and save on every order. Highlight wallet top-up benefits.",
];

const SYSTEM_MSG =
  "You are an email marketing expert for GSM World Store, a phone unlocking and mobile tool business. " +
  "Generate a professional, engaging daily marketing announcement email. " +
  "You MUST respond with valid JSON only — no markdown, no code fences. " +
  "The JSON must have exactly two keys: " +
  "'subject' (a compelling email subject line, max 70 chars, include an emoji) and " +
  "'body' (plain text, 3-4 paragraphs separated by newlines, no HTML tags, conversational but professional tone).";

export interface MarketingResult {
  ok: boolean;
  recipientCount: number;
  subject: string;
  aiSucceeded: boolean;
  error?: string;
}

export async function runDailyMarketingEmail(): Promise<MarketingResult> {
  // Pick a prompt based on day-of-week (Mon=0 … Sun=6) so content rotates.
  const dayIndex = new Date().getDay(); // 0=Sun … 6=Sat
  const prompt = DAILY_PROMPTS[dayIndex % DAILY_PROMPTS.length]!;

  let subject = "";
  let body = "";
  let aiSucceeded = false;

  // ── Try AI generation ──────────────────────────────────────────────────────
  try {
    const [apiKey, openaiBase] = await Promise.all([getOpenAiKey(), getOpenAiBaseUrl()]);

    if (apiKey) {
      const isOpenRouter = openaiBase.toLowerCase().includes("openrouter");
      const baseURL = openaiBase.endsWith("/v1") ? openaiBase : `${openaiBase}/v1`;
      const modelCascade = isOpenRouter ? await getWorkingCascade() : ["gpt-4o-mini"];

      for (const model of modelCascade) {
        const reqBody: Record<string, unknown> = {
          model,
          stream: false,
          max_tokens: 800,
          temperature: 0.8,
          messages: [
            { role: "system", content: SYSTEM_MSG },
            { role: "user", content: `Today's topic: ${prompt}` },
          ],
        };
        if (!isOpenRouter) reqBody.response_format = { type: "json_object" };

        let r: Response;
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 25000);
          r = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            signal: ctrl.signal,
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "HTTP-Referer": "https://gsmworld.vercel.app",
              "X-Title": "GSMWorld DailyMarketing",
            },
            body: JSON.stringify(reqBody),
          });
          clearTimeout(timer);
        } catch {
          continue;
        }

        if (!r.ok) continue;

        const aiData = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
        const raw = aiData.choices?.[0]?.message?.content?.trim() ?? "";
        if (!raw) continue;

        const cleaned = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();

        try {
          const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };
          if (parsed.subject && parsed.body) {
            subject = parsed.subject;
            body = parsed.body;
            aiSucceeded = true;
            break;
          }
        } catch {
          continue;
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "Daily marketing: AI generation error, using fallback");
  }

  // ── Fallback template if AI unavailable ───────────────────────────────────
  if (!aiSucceeded) {
    const dayName = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "Africa/Nairobi" });
    subject = `🌟 Good ${dayName === "Saturday" || dayName === "Sunday" ? "Weekend" : "Morning"} from GSM World!`;
    body = [
      "Hello from GSM World Store!",
      "We are your trusted partner for professional phone unlocking tools, GSM services, and mobile repair accessories. Our store is stocked with the latest products at competitive prices.",
      "Whether you are a phone technician or an individual looking to unlock your device, we have the right solution for you. Browse our full catalogue and place your order today — funds in your wallet are always available for instant checkout.",
      "Visit our store now and take advantage of our great prices. Our team is always available to support you. Thank you for being part of the GSM World community!",
    ].join("\n\n");
  }

  // ── Send to all active users ───────────────────────────────────────────────
  let recipientCount = 0;
  let sendError: string | undefined;

  try {
    const allUsers = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.status, "active"));

    const htmlContent = announcementEmail({ subject, body });

    for (const u of allUsers) {
      try {
        await sendEmail({ to: u.email, subject, text: body, html: htmlContent });
        recipientCount++;
      } catch {
        // Skip individual failures — don't abort the whole batch.
      }
    }

    logger.info({ recipientCount, subject, aiSucceeded }, "Daily marketing email broadcast complete");
  } catch (err) {
    sendError = String(err);
    logger.error({ err }, "Daily marketing: failed to send emails");
  }

  return {
    ok: !sendError,
    recipientCount,
    subject,
    aiSucceeded,
    ...(sendError ? { error: sendError } : {}),
  };
}

/**
 * Returns true if "now" (in EAT = UTC+3) is exactly 03:50 and the job
 * has not already been triggered today (date guard prevents double-firing
 * within the same minute if the ticker drifts slightly).
 */
let _lastDailyRun: string | null = null;

export function shouldRunDailyMarketing(): boolean {
  const now = new Date();
  // EAT = UTC+3
  const eatHour   = (now.getUTCHours() + 3) % 24;
  const eatMinute = now.getUTCMinutes();
  // Date string in EAT
  const eatDateStr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  if (eatHour === 3 && eatMinute === 50 && _lastDailyRun !== eatDateStr) {
    _lastDailyRun = eatDateStr;
    return true;
  }
  return false;
}
