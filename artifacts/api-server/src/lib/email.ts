import nodemailer from "nodemailer";
import crypto from "crypto";
import { logger } from "./logger";

function makeUnsubToken(email: string): string {
  const secret = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";
  return crypto.createHmac("sha256", secret).update(email.toLowerCase().trim()).digest("hex").slice(0, 32);
}

function buildUnsubUrl(email: string): string {
  const base = getBaseUrl();
  return `${base.replace(/\/$/, "")}/api/unsubscribe?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${makeUnsubToken(email)}`;
}

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function getBaseUrl() {
  return process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://gsmworld.vercel.app";
}

export function appUrl(path: string) {
  const base = getBaseUrl().replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

// ── Shared layout ─────────────────────────────────────────────────────────────

function layout(preheader: string, accentColor: string, headerContent: string, body: string) {
  const year = new Date().getFullYear();
  const storeUrl = getBaseUrl();
  let hostname = "gsmworld.co.ke";
  try { hostname = new URL(storeUrl).hostname; } catch { /* fallback */ }
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>GSM World</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @media only screen and (max-width:620px) {
      .ow { padding:0 !important; }
      .shell { border-radius:0 !important; }
      .ehead { padding:28px 20px 24px !important; }
      .ehead h1 { font-size:22px !important; line-height:1.3 !important; }
      .ebody { padding:24px 18px 20px !important; font-size:14px !important; }
      .efooter { padding:20px 18px !important; }
      .btn-cta { padding:14px 20px !important; font-size:15px !important; }
      .digit-box { width:40px !important; height:52px !important; font-size:26px !important; }
      .product-cell { width:100% !important; display:block !important; padding-right:0 !important; }
    }
    a { color:inherit; text-decoration:none; }
    * { box-sizing:border-box; }
  </style>
</head>
<body style="margin:0;padding:0;background:#e8edf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#e8edf4;line-height:1px;">${preheader} &nbsp;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;&#8203;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ow" style="background:#e8edf4;padding:32px 16px 48px;">
    <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin-bottom:16px;">
          <tr><td style="text-align:center;padding:0 8px;">
              <a href="${storeUrl}" style="text-decoration:none;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
                    <td style="vertical-align:middle;padding-right:9px;">
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                          <td style="width:32px;height:32px;background:linear-gradient(145deg,#0ea5e9 0%,#0369a1 100%);border-radius:9px;text-align:center;vertical-align:middle;">
                            <span style="font-size:17px;font-weight:900;color:#fff;font-family:Arial,sans-serif;line-height:32px;display:block;">G</span>
                          </td>
                      </tr></table>
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="font-size:16px;font-weight:800;color:#0f172a;letter-spacing:-0.2px;font-family:Arial,sans-serif;">GSM&nbsp;<span style="color:#0ea5e9;">World</span></span>
                    </td>
                </tr></table>
              </a>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="shell" style="max-width:580px;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.12),0 2px 8px rgba(15,23,42,0.06);">
          <tr><td style="background:${accentColor};height:3px;padding:0;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>
          <tr><td style="padding:0;">${headerContent}</td></tr>
          <tr><td class="ebody" style="background:#ffffff;padding:32px 36px 28px;color:#374151;font-size:15px;line-height:1.8;">${body}</td></tr>
          <tr>
            <td class="efooter" style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 36px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e9eef5;">
                    <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;line-height:1.6;">You received this because you have a GSM World account.</p>
                    <p style="margin:0;font-size:12px;line-height:2.2;">
                      <a href="${storeUrl}" style="color:#0ea5e9;text-decoration:none;font-weight:700;">${hostname}</a>
                      <span style="color:#e2e8f0;">&nbsp;|&nbsp;</span>
                      <a href="${storeUrl}/account/orders" style="color:#64748b;text-decoration:none;font-weight:600;">My Orders</a>
                      <span style="color:#e2e8f0;">&nbsp;|&nbsp;</span>
                      <a href="${storeUrl}/account" style="color:#64748b;text-decoration:none;font-weight:600;">My Account</a>
                      <span style="color:#e2e8f0;">&nbsp;|&nbsp;</span>
                      <a href="https://wa.me/254700000000" style="color:#22c55e;text-decoration:none;font-weight:600;">WhatsApp Support</a>
                      <span style="color:#e2e8f0;">&nbsp;|&nbsp;</span>
                      <a href="{{UNSUB_URL}}" style="color:#94a3b8;text-decoration:underline;font-weight:500;">Unsubscribe</a>
                    </p>
                </td></tr>
                <tr><td style="text-align:center;padding-top:16px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;line-height:1.6;">&copy; ${year} GSM World &mdash; Professional GSM Tools &amp; Services</p>
                    <p style="margin:0;font-size:10.5px;color:#cbd5e1;line-height:1.5;">Nairobi, Kenya &nbsp;&middot;&nbsp; <a href="mailto:support@dasnett.site" style="color:#cbd5e1;text-decoration:none;">support@dasnett.site</a></p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function header(bg: string, title: string, subtitle: string) {
  return `<div class="ehead" style="background:${bg};padding:38px 36px 32px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,0.06);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-60px;left:-30px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,0.04);pointer-events:none;"></div>
    <div style="position:absolute;top:20px;right:60px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.05);pointer-events:none;"></div>
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;position:relative;">${title}</h1>
    <p style="margin:0;font-size:13.5px;color:rgba(255,255,255,0.65);font-weight:400;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;position:relative;">${subtitle}</p>
  </div>`;
}

function btn(label: string, url: string, bg = "#0ea5e9") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 6px;width:100%;">
    <tr>
      <td style="border-radius:12px;background:${bg};box-shadow:0 4px 14px ${bg}55;">
        <a href="${url}" class="btn-cta" style="display:block;padding:16px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">${label} &rarr;</a>
      </td>
    </tr>
  </table>
  <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;text-align:center;word-break:break-all;font-family:Arial,sans-serif;">Or copy: <a href="${url}" style="color:#64748b;text-decoration:underline;">${url}</a></p>`;
}

function codeBlock(code: string) {
  const digits = code.split("").map(ch =>
    `<td style="padding:0 5px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td class="digit-box" style="width:52px;height:64px;background:#1e293b;border:2px solid #334155;border-radius:14px;text-align:center;vertical-align:middle;font-size:32px;font-weight:900;color:#38bdf8;font-family:'Courier New',Courier,monospace;line-height:1;">${ch}</td>
      </tr></table>
    </td>`
  ).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td align="center" style="background:#0f172a;border-radius:20px;padding:36px 24px 28px;">
        <p style="margin:0 0 20px;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:2.5px;font-family:Arial,sans-serif;">Your Verification Code</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>${digits}</tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 0;">
          <tr>
            <td style="background:#1e293b;border-radius:50px;padding:9px 24px;text-align:center;">
              <span style="font-size:12px;color:#64748b;font-family:Arial,sans-serif;">&#x23F1;&nbsp; Expires in <strong style="color:#94a3b8;">10 minutes</strong>&nbsp;&nbsp;&middot;&nbsp;&nbsp;Never share this code</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function infoTable(rows: Array<[string, string]>) {
  const trs = rows.map(([label, value], i) => `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};">
    <td style="padding:13px 16px 13px 20px;${i < rows.length - 1 ? "border-bottom:1px solid #f1f5f9;" : ""}font-size:11.5px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;width:36%;vertical-align:middle;">${label}</td>
    <td style="padding:13px 20px 13px 12px;${i < rows.length - 1 ? "border-bottom:1px solid #f1f5f9;" : ""}font-size:14px;font-weight:600;color:#0f172a;word-break:break-word;vertical-align:middle;">${value}</td>
  </tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #e5e7eb;border-radius:14px;overflow:hidden;margin:24px 0;">
    <tbody>${trs}</tbody>
  </table>`;
}

function statusChip(label: string, color: string) {
  const icon = (color === "#059669") ? "&#x2713;" : (color === "#dc2626" || color === "#b91c1c") ? "&#x2715;" : (color === "#d97706") ? "&#x26A0;" : "&#x25CF;";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
    <tr>
      <td style="background:${color}15;border:1.5px solid ${color}40;border-radius:50px;padding:10px 24px;">
        <span style="font-size:13.5px;font-weight:800;color:${color};letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${icon}&nbsp;&nbsp;${label}</span>
      </td>
    </tr>
  </table>`;
}

function orderItemsTable(items: Array<{ productName: string; quantity: number; price: string }>, total: string) {
  const rows = items.map((item, i) =>
    `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafafa"};">
      <td style="padding:14px 12px 14px 20px;font-size:13.5px;color:#1f2937;border-bottom:1px solid #f3f4f6;line-height:1.45;"><span style="display:inline-block;width:7px;height:7px;background:#0ea5e9;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>${item.productName}</td>
      <td style="padding:14px 12px;font-size:13px;color:#9ca3af;border-bottom:1px solid #f3f4f6;text-align:center;white-space:nowrap;font-weight:700;">&times;&nbsp;${item.quantity}</td>
      <td style="padding:14px 20px 14px 0;font-size:14px;font-weight:700;color:#0f172a;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1.5px solid #e5e7eb;border-radius:16px;overflow:hidden;margin:24px 0;">
    <thead>
      <tr style="background:#f8fafc;">
        <th style="padding:12px 12px 12px 20px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.2px;text-align:left;">Product / Service</th>
        <th style="padding:12px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.2px;text-align:center;">Qty</th>
        <th style="padding:12px 20px 12px 0;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.2px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);">
        <td colspan="2" style="padding:16px 12px 16px 20px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Total Amount Due</td>
        <td style="padding:16px 20px 16px 0;font-size:22px;font-weight:900;color:#38bdf8;text-align:right;font-family:'Courier New',Courier,monospace;">$${parseFloat(total).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>`;
}

function alertBox(title: string, content: string, borderColor = "#0ea5e9", bg = "#f0f9ff") {
  const titleHtml = title
    ? `<p style="margin:0 0 7px;font-size:11px;font-weight:800;color:${borderColor};text-transform:uppercase;letter-spacing:1.2px;font-family:Arial,sans-serif;">&#x2139;&nbsp; ${title}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
    <tr>
      <td style="background:${bg};border:1px solid ${borderColor}25;border-left:4px solid ${borderColor};border-radius:0 14px 14px 0;padding:16px 20px;">
        ${titleHtml}
        <p style="margin:0;font-size:14px;color:#1f2937;white-space:pre-line;line-height:1.75;">${content}</p>
      </td>
    </tr>
  </table>`;
}

function stepsSection(steps: string[]) {
  const rows = steps.map((step, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${i < steps.length - 1 ? "14px" : "0"};">
      <tr>
        <td style="width:30px;vertical-align:top;padding-top:1px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:26px;height:26px;background:#0ea5e9;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:900;color:#fff;font-family:Arial,sans-serif;line-height:26px;">${i + 1}</td>
          </tr></table>
        </td>
        <td style="padding-left:12px;font-size:13.5px;color:#475569;line-height:1.65;vertical-align:top;padding-top:2px;">${step}</td>
      </tr>
    </table>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:#f8fafc;border:1.5px solid #e9eef5;border-radius:16px;padding:22px 24px;">
        <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.8px;font-family:Arial,sans-serif;">What happens next</p>
        ${rows}
      </td>
    </tr>
  </table>`;
}

// ── Email sender ──────────────────────────────────────────────────────────────

export async function sendEmail(message: EmailMessage) {
  let smtpHost: string | null = process.env.SMTP_HOST || null;
  let smtpPort: string | null = process.env.SMTP_PORT || null;
  let smtpUser: string | null = process.env.SMTP_USER || null;
  let smtpPass: string | null = process.env.SMTP_PASS || null;
  let emailFrom: string | null = process.env.EMAIL_FROM || null;
  let smtpSecure = process.env.SMTP_SECURE === "true";

  if (!smtpHost || !emailFrom) {
    try {
      const { getSmtpConfig } = await import("./admin-settings");
      const cfg = await getSmtpConfig();
      smtpHost = smtpHost || cfg.smtpHost;
      smtpPort = smtpPort || cfg.smtpPort;
      smtpUser = smtpUser || cfg.smtpUser;
      smtpPass = smtpPass || cfg.smtpPass;
      emailFrom = emailFrom || cfg.emailFrom;
      smtpSecure = smtpSecure || cfg.smtpSecure;
    } catch {
      // DB not available
    }
  }

  // If EMAIL_FROM not set, fall back to SMTP_USER as sender (common SMTP convention)
  if (!emailFrom && smtpUser) {
    emailFrom = smtpUser;
  }

  const fromAddress = emailFrom ? `GSM World <${emailFrom}>` : null;
  const unsubscribeUrl = buildUnsubUrl(message.to);
  const processedHtml = message.html?.replace(/\{\{UNSUB_URL\}\}/g, unsubscribeUrl);

  // Derive the sending domain from emailFrom so Message-ID / List-Unsubscribe
  // always match the verified sender domain (mismatches are a top spam trigger).
  const sendingDomain = emailFrom?.split("@")[1] ?? "gsmworld.co.ke";
  const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2, 10)}@${sendingDomain}>`;
  const entityRef = `gsm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sharedHeaders: Record<string, string> = {
    "Message-ID": msgId,
    "X-Entity-Ref-ID": entityRef,
    "MIME-Version": "1.0",
    "Precedence": "transactional",
    "X-Priority": "3",
    "X-MS-Exchange-Organization-SCL": "-1",
    "X-Mailer": "GSM World Mailer/2.0",
    "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:unsubscribe@${sendingDomain}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "Feedback-ID": `transactional:gsm-world:${sendingDomain}`,
  };

  // ── SMTP (Zoho) ──
  if (!emailFrom || !smtpHost) {
    logger.info({ to: message.to, subject: message.subject }, "Email skipped: no SMTP provider configured (add Zoho SMTP settings in admin panel)");
    return { sent: false, reason: "No email provider configured. Add Zoho SMTP settings in Admin → Settings." };
  }

  const port = Number(smtpPort || 587);
  // Port 465 = implicit SSL/TLS (secure must be true).
  // Port 587 = STARTTLS (secure false + requireTLS true).
  // Respect the admin setting but auto-correct for port 465.
  const secure = port === 465 ? true : smtpSecure;
  const requireTLS = !secure && port === 587;

  // Zoho (and many providers) require the From address to exactly match the
  // authenticated SMTP user — use smtpUser as the envelope sender when set.
  const envelopeFrom = smtpUser
    ? `GSM World <${smtpUser}>`
    : (fromAddress ?? `GSM World <${emailFrom}>`);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port,
    secure,
    requireTLS,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    tls: {
      minVersion: "TLSv1.2",
      // Use false so that self-signed/intermediate certs don't block delivery.
      rejectUnauthorized: false,
    },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 25000,
  });

  try {
    await transporter.sendMail({
      from: envelopeFrom,
      replyTo: emailFrom ?? smtpUser ?? undefined,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: processedHtml,
      headers: sharedHeaders,
    });
    logger.info({ to: message.to, subject: message.subject, host: smtpHost, port, secure }, "Email sent via SMTP");
    return { sent: true, provider: "smtp" };
  } catch (err) {
    logger.error({ to: message.to, subject: message.subject, host: smtpHost, port, secure, err }, "SMTP delivery failed");
    return { sent: false, reason: String(err) };
  }
}

// ── 1. Sign-up / Email Verification ──────────────────────────────────────────

export function otpEmail(code: string) {
  const h = header(
    "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    "Verify Your Email Address",
    "Complete your GSM World registration"
  );
  const body = `
    <p style="margin:0 0 6px;font-size:15px;color:#0f172a;font-weight:700;">Welcome to GSM World.</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Thank you for creating an account. To activate your account and access all features, please verify your email address using the code below.</p>
    ${codeBlock(code)}
    <p style="margin:0 0 6px;font-size:14px;color:#475569;">Enter this code on the verification screen to complete your registration.</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">For your security, this code is valid for <strong style="color:#0f172a;">10 minutes only</strong>. Never share this code with anyone — GSM World staff will never ask for it.</p>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">The GSM World Team</strong></p>
    </div>
  `;
  return {
    subject: `${code} is your GSM World verification code`,
    text: `Your GSM World verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\nIf you did not create this account, you can safely ignore this email.\n\n— GSM World Team`,
    html: layout(`${code} is your GSM World verification code — expires in 10 minutes.`, "#0ea5e9", h, body),
  };
}

// ── 2. Login notification ─────────────────────────────────────────────────────

export function loginNotificationEmail(name: string | null, meta?: { ip?: string; device?: string }) {
  const displayName = name || "Valued Customer";
  const time = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  const securityUrl = appUrl("/account/security");

  const h = header(
    "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",
    "New Sign-In Detected",
    "A sign-in was recorded on your account"
  );
  const rows: Array<[string, string]> = [["Date & Time", time]];
  if (meta?.ip) rows.push(["IP Address", meta.ip]);
  if (meta?.device) rows.push(["Device", meta.device]);

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${displayName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">We are writing to inform you that a successful sign-in was just recorded on your GSM World account.</p>
    ${infoTable(rows)}
    <p style="margin:0 0 6px;font-size:14px;color:#475569;"><strong style="color:#0f172a;">This was you?</strong> No action is required. You may disregard this message.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;"><strong style="color:#dc2626;">This was not you?</strong> Your account may be compromised. We strongly recommend you change your password immediately.</p>
    ${btn("Secure My Account", securityUrl, "#dc2626")}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">If you need assistance, contact our support team via WhatsApp or the live chat on our website.</p>
      <p style="margin:12px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Security Team</strong></p>
    </div>
  `;
  return {
    subject: "Sign-In Notice: New Access to Your GSM World Account",
    text: `Dear ${displayName},\n\nA new sign-in was detected on your GSM World account.\n\nTime: ${time}${meta?.ip ? `\nIP: ${meta.ip}` : ""}${meta?.device ? `\nDevice: ${meta.device}` : ""}\n\nIf this was not you, secure your account immediately: ${securityUrl}\n\n— GSM World Security Team`,
    html: layout(`New sign-in recorded on your GSM World account at ${time}.`, "#dc2626", h, body),
  };
}

// ── 3. Order submitted ────────────────────────────────────────────────────────

export function orderSubmittedEmail(params: {
  orderId: number;
  orderCode?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  items: Array<{ productName: string; quantity: number; price: string }>;
  total: string;
  paymentMethod: string;
}) {
  const ref = params.orderCode || String(params.orderId);
  const name = params.customerName || "Valued Customer";
  const orderUrl = params.customerEmail
    ? appUrl(`/orders/lookup?orderId=${params.orderId}&email=${encodeURIComponent(params.customerEmail)}`)
    : appUrl(`/orders/${params.orderId}`);
  const payLabel: Record<string, string> = {
    mpesa: "M-Pesa (STK Push)",
    wallet: "GSM World Wallet",
    nowpayments: "NOWPayments",
    usdt: "Digital Currency Payment",
    binance_pay: "Binance",
    usdt_manual: "Digital Transfer",
  };
  const pmLabel = payLabel[params.paymentMethod] ?? params.paymentMethod;

  const h = header(
    "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    `Order #${ref} Confirmed`,
    "Thank you for your purchase — your order is being reviewed"
  );
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Thank you for your order. We have received it successfully and our team is now reviewing your request. Here is a summary:</p>
    ${orderItemsTable(params.items, params.total)}
    ${infoTable([
      ["Order Reference", `#${ref}`],
      ["Payment Method", pmLabel],
      ["Status", "&#x23F3;&nbsp; Pending Review"],
    ])}
    ${stepsSection([
      "Our team reviews your order and verifies your payment — usually within <strong style=\"color:#0f172a;\">10–30 minutes</strong>.",
      "You will receive an email update as soon as your order status changes.",
      "Once processed, your service is delivered and a completion email is sent with full details.",
    ])}
    ${btn("Track Your Order", orderUrl)}
    <div style="margin-top:28px;padding-top:18px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:13px;color:#64748b;">Save your reference: <strong style="color:#0f172a;">Order #${ref}</strong></p>
      <p style="margin:10px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;
  const textItems = params.items.map(i => `  - ${i.productName} × ${i.quantity}  ($${(parseFloat(i.price) * i.quantity).toFixed(2)})`).join("\n");
  return {
    subject: `Order #${ref} Confirmed — GSM World`,
    text: `Dear ${name},\n\nYour order #${ref} has been received and is under review.\n\nItems:\n${textItems}\n\nTotal: $${parseFloat(params.total).toFixed(2)}\nPayment: ${pmLabel}\n\nTrack your order: ${orderUrl}\n\nEstimated processing: 10–30 minutes.\n\n— GSM World Team`,
    html: layout(`Order #${ref} received — we are processing your request.`, "#0ea5e9", h, body),
  };
}

// ── 4. Payment confirmed ──────────────────────────────────────────────────────

export function paymentConfirmedEmail(params: {
  orderId: number;
  orderCode?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  amount: string;
  paymentMethod: string;
  transactionRef?: string | null;
  items?: Array<{ productName: string; quantity: number; price: string }>;
}) {
  const ref = params.orderCode || String(params.orderId);
  const name = params.customerName || "Valued Customer";
  const orderUrl = params.customerEmail
    ? appUrl(`/orders/lookup?orderId=${params.orderId}&email=${encodeURIComponent(params.customerEmail)}`)
    : appUrl(`/orders/${params.orderId}`);
  const supportUrl = appUrl("/account/chat");
  const payLabel: Record<string, string> = {
    mpesa: "M-Pesa",
    wallet: "GSM World Wallet",
    nowpayments: "Crypto (NOWPayments)",
    binance_pay: "Binance Pay",
    usdt_manual: "USDT Transfer",
    card: "Card",
  };
  const pmLabel = payLabel[params.paymentMethod] ?? params.paymentMethod;
  const paidAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

  const h = header(
    "linear-gradient(135deg,#064e3b 0%,#059669 100%)",
    "Payment Confirmed",
    `Your payment for Order #${ref} has been verified`
  );

  const infoRows: Array<[string, string]> = [
    ["Order Reference", `#${ref}`],
    ["Amount Paid", `$${parseFloat(params.amount).toFixed(2)} USD`],
    ["Payment Method", pmLabel],
    ["Confirmed At", paidAt],
  ];
  if (params.transactionRef) infoRows.push(["Transaction Ref", params.transactionRef]);

  const itemsSection = params.items && params.items.length > 0
    ? `<p style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order Summary</p>${orderItemsTable(params.items, params.amount)}`
    : "";

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Great news — your payment has been verified and confirmed. Your order is now in our processing queue.</p>
    ${statusChip("&#x2713;&nbsp; Payment Verified — Processing Now", "#059669")}
    ${infoTable(infoRows)}
    ${itemsSection}
    ${stepsSection([
      "<strong style=\"color:#059669;\">Payment confirmed.</strong> Your funds have been received and verified on our end.",
      "Our processing team is working on your order <strong>right now</strong> — estimated time: 10–30 minutes.",
      "You will receive a completion email with your full delivery details once the service is ready.",
    ])}
    ${btn("Track Your Order", orderUrl, "#059669")}
    <div style="margin-top:28px;padding-top:18px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:13px;color:#64748b;">Keep this as your receipt. Reference: <strong style="color:#0f172a;">ORDER-${ref}</strong></p>
      <p style="margin:10px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;

  const textItems = params.items && params.items.length > 0
    ? `\nOrder Summary:\n${params.items.map(i => `  - ${i.productName} × ${i.quantity}  ($${(parseFloat(i.price) * i.quantity).toFixed(2)})`).join("\n")}\n`
    : "";

  return {
    subject: `Payment Confirmed — Order #${ref} | GSM World`,
    text: `Dear ${name},\n\nYour payment of $${parseFloat(params.amount).toFixed(2)} for Order #${ref} has been confirmed via ${pmLabel} at ${paidAt}.${textItems}\nYour order is being processed (10–30 min).\n\nTrack order: ${orderUrl}\nContact support: ${supportUrl}\n\nKeep this email as your receipt. Reference: ORDER-${ref}\n\n— GSM World Team`,
    html: layout(`Payment confirmed for Order #${ref} — processing now.`, "#059669", h, body),
  };
}

// ── 5. Wallet transfer — sender receipt ───────────────────────────────────────

export function walletTransferSentEmail(params: {
  senderName?: string | null;
  recipientUsername: string;
  amount: number;
  fee: number;
  totalDeducted: number;
  newBalance?: number | null;
}) {
  const name = params.senderName || "Valued Customer";
  const walletUrl = appUrl("/account/wallet");
  const sentAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

  const h = header(
    "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    "Transfer Sent",
    `Your wallet transfer to @${params.recipientUsername} was successful`
  );

  const infoRows: Array<[string, string]> = [
    ["Recipient",      `@${params.recipientUsername}`],
    ["Amount Sent",    `$${params.amount.toFixed(2)} USD`],
    ["Transfer Fee",   `$${params.fee.toFixed(2)} USD`],
    ["Total Deducted", `$${params.totalDeducted.toFixed(2)} USD`],
    ["Date & Time",    sentAt],
  ];
  if (params.newBalance != null) {
    infoRows.push(["Remaining Balance", `$${params.newBalance.toFixed(2)} USD`]);
  }

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Your wallet transfer has been processed successfully. Here is a summary of the transaction:</p>
    ${infoTable(infoRows)}
    ${statusChip("Transfer Successful", "#0ea5e9")}
    <p style="margin:16px 0 0;font-size:14px;color:#475569;">If you did not authorise this transfer, please contact our support team immediately.</p>
    ${btn("View My Wallet", walletUrl)}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:13px;color:#64748b;">Keep this email as your transfer receipt.</p>
      <p style="margin:12px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;

  return {
    subject: `Transfer to @${params.recipientUsername} Confirmed — GSM World`,
    text: `Dear ${name},\n\nYour transfer of $${params.amount.toFixed(2)} to @${params.recipientUsername} was successful.\n\nFee: $${params.fee.toFixed(2)}\nTotal deducted: $${params.totalDeducted.toFixed(2)}\nDate: ${sentAt}${params.newBalance != null ? `\nNew balance: $${params.newBalance.toFixed(2)}` : ""}\n\nIf you did not authorise this transfer, contact support immediately.\n\nView your wallet: ${walletUrl}\n\n— GSM World Team`,
    html: layout(`Your transfer to @${params.recipientUsername} has been processed successfully.`, "#0ea5e9", h, body),
  };
}

// ── 5b. Wallet transfer — recipient notification ───────────────────────────────

export function walletTransferReceivedEmail(params: {
  recipientName?: string | null;
  senderUsername: string;
  amount: number;
  newBalance?: number | null;
}) {
  const name = params.recipientName || "Valued Customer";
  const walletUrl = appUrl("/account/wallet");
  const receivedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

  const h = header(
    "linear-gradient(135deg,#064e3b 0%,#059669 100%)",
    "Wallet Credit Notification",
    `Your GSM World wallet has been credited by @${params.senderUsername}`
  );

  const infoRows: Array<[string, string]> = [
    ["Credited By",     `@${params.senderUsername}`],
    ["Amount Credited", `$${params.amount.toFixed(2)} USD`],
    ["Date & Time",     receivedAt],
  ];
  if (params.newBalance != null) {
    infoRows.push(["Updated Wallet Balance", `$${params.newBalance.toFixed(2)} USD`]);
  }

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">This is to inform you that your GSM World wallet has been credited. Below is a summary of the transaction:</p>
    ${infoTable(infoRows)}
    ${statusChip("Wallet Balance Updated", "#059669")}
    <p style="margin:16px 0 0;font-size:14px;color:#475569;">Your updated balance is available immediately for purchases or further transfers on your account.</p>
    ${btn("View My Account", walletUrl, "#059669")}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:13px;color:#94a3b8;">This is an automated account activity notification from GSM World. If you did not expect this credit, please contact our support team.</p>
      <p style="margin:12px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;

  return {
    subject: `Wallet Credit Received — GSM World`,
    text: `Dear ${name},\n\nYour GSM World wallet has been credited.\n\nCredited By: @${params.senderUsername}\nAmount: $${params.amount.toFixed(2)} USD\nDate: ${receivedAt}${params.newBalance != null ? `\nUpdated Balance: $${params.newBalance.toFixed(2)} USD` : ""}\n\nThis credit is available immediately on your account.\n\nView your account: ${walletUrl}\n\nIf you did not expect this credit, contact our support team.\n\n— GSM World Team`,
    html: layout(`Your wallet has been credited — new balance available on your account.`, "#059669", h, body),
  };
}

// ── 6. Order status update ────────────────────────────────────────────────────

export function orderStatusUpdateEmail(params: {
  orderId: number;
  customerName?: string | null;
  customerEmail?: string | null;
  status: string;
  notes?: string | null;
}) {
  const name = params.customerName || "Valued Customer";
  const orderUrl = params.customerEmail
    ? appUrl(`/orders/lookup?orderId=${params.orderId}&email=${encodeURIComponent(params.customerEmail)}`)
    : appUrl(`/orders/${params.orderId}`);
  const statusMap: Record<string, { label: string; color: string; bg: string; accent: string }> = {
    paid:                         { label: "Payment Confirmed",             color: "#059669", bg: "linear-gradient(135deg,#064e3b 0%,#059669 100%)", accent: "#059669" },
    processing:                   { label: "Order in Processing",           color: "#0ea5e9", bg: "linear-gradient(135deg,#0f172a 0%,#0369a1 100%)", accent: "#0ea5e9" },
    pending:                      { label: "Pending Review",                color: "#d97706", bg: "linear-gradient(135deg,#78350f 0%,#d97706 100%)", accent: "#d97706" },
    pending_payment_confirmation: { label: "Awaiting Payment Verification", color: "#7c3aed", bg: "linear-gradient(135deg,#3b0764 0%,#7c3aed 100%)", accent: "#7c3aed" },
    completed:                    { label: "Order Completed",               color: "#059669", bg: "linear-gradient(135deg,#064e3b 0%,#059669 100%)", accent: "#059669" },
    failed:                       { label: "Order Unsuccessful",            color: "#dc2626", bg: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%)", accent: "#dc2626" },
    refunded:                     { label: "Order Refunded",                color: "#64748b", bg: "linear-gradient(135deg,#1e293b 0%,#64748b 100%)", accent: "#64748b" },
    cancelled:                    { label: "Order Cancelled",               color: "#dc2626", bg: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%)", accent: "#dc2626" },
    rejected:                     { label: "Order Rejected",                color: "#b91c1c", bg: "linear-gradient(135deg,#450a0a 0%,#b91c1c 100%)", accent: "#b91c1c" },
  };
  const st = statusMap[params.status] ?? { label: params.status, color: "#0f172a", bg: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)", accent: "#0ea5e9" };

  const h = header(st.bg, `Order #${params.orderId} — Status Update`, st.label);
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">We are writing to inform you of an update to your <strong style="color:#0f172a;">Order #${params.orderId}</strong>.</p>
    ${statusChip(st.label, st.color)}
    ${params.notes ? alertBox("Message from Our Team", params.notes, st.accent, "#f8fafc") : ""}
    ${btn("View Order Details", orderUrl, st.accent)}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">For any questions or concerns, please reply to this email or contact us via WhatsApp.</p>
      <p style="margin:12px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;
  return {
    subject: `Order #${params.orderId} Update: ${st.label} — GSM World`,
    text: `Dear ${name},\n\nYour Order #${params.orderId} has been updated.\n\nNew Status: ${st.label}\n${params.notes ? `\nTeam Message:\n${params.notes}\n` : ""}\nView your order: ${orderUrl}\n\n— GSM World Team`,
    html: layout(`Order #${params.orderId} status update: ${st.label}.`, st.accent, h, body),
  };
}

// ── 6. More information required ──────────────────────────────────────────────

export function moreInfoNeededEmail(params: {
  orderId: number;
  customerName?: string | null;
  customerEmail?: string | null;
  message: string;
}) {
  const name = params.customerName || "Valued Customer";
  const orderUrl = params.customerEmail
    ? appUrl(`/orders/lookup?orderId=${params.orderId}&email=${encodeURIComponent(params.customerEmail)}`)
    : appUrl(`/orders/${params.orderId}`);

  const h = header(
    "linear-gradient(135deg,#78350f 0%,#d97706 100%)",
    "Action Required",
    `Additional information needed for Order #${params.orderId}`
  );
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Our team requires additional information to complete your <strong style="color:#0f172a;">Order #${params.orderId}</strong>. Please review the message below and respond at your earliest convenience.</p>
    ${alertBox("Message from GSM World Team", params.message, "#d97706", "#fffbeb")}
    <p style="margin:20px 0 8px;font-size:14px;font-weight:700;color:#0f172a;">How to respond:</p>
    <ol style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:2;">
      <li>Click the button below to open your order page.</li>
      <li>Use the <strong>Reply / Upload File</strong> section to send us the required information or attach any files.</li>
      <li>Our team will review and respond promptly.</li>
    </ol>
    ${btn("Open Order & Respond", orderUrl, "#d97706")}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:13px;color:#94a3b8;">Accepted formats: images, PDFs, screenshots. For assistance, contact us via WhatsApp.</p>
      <p style="margin:12px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;
  return {
    subject: `Action Required: Order #${params.orderId} — Additional Information Needed`,
    text: `Dear ${name},\n\nOur team needs additional information to process your Order #${params.orderId}.\n\nMessage from our team:\n${params.message}\n\nPlease log in to your account and respond: ${orderUrl}\n\n— GSM World Team`,
    html: layout(`Action required for Order #${params.orderId} — please respond at your earliest convenience.`, "#d97706", h, body),
  };
}

// ── 7. Order completed with result ────────────────────────────────────────────

export function orderCompletedEmail(params: {
  orderId: number;
  customerName?: string | null;
  customerEmail?: string | null;
  items?: Array<{ productName: string; quantity: number; price: string }>;
  total?: string | null;
  notes?: string | null;
  result?: string | null;
}) {
  const name = params.customerName || "Valued Customer";
  const orderUrl = params.customerEmail
    ? appUrl(`/orders/lookup?orderId=${params.orderId}&email=${encodeURIComponent(params.customerEmail)}`)
    : appUrl(`/orders/${params.orderId}`);
  const deliveryNote = params.notes || params.result;

  const h = header(
    "linear-gradient(135deg,#064e3b 0%,#059669 100%)",
    "Order Successfully Completed",
    `Your Order #${params.orderId} has been delivered`
  );
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">We are pleased to inform you that your <strong style="color:#0f172a;">Order #${params.orderId}</strong> has been successfully completed. Your service has been delivered.</p>
    ${statusChip("Order Completed", "#059669")}
    ${params.items && params.items.length > 0 && params.total ? orderItemsTable(params.items, params.total) : ""}
    ${deliveryNote ? alertBox("Delivery Details", deliveryNote, "#059669", "#f0fdf4") : ""}
    ${btn("View Order & Result", orderUrl, "#059669")}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">Thank you for choosing GSM World. We value your business and look forward to serving you again.</p>
      <p style="margin:12px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;
  return {
    subject: `Order #${params.orderId} Completed — GSM World`,
    text: `Dear ${name},\n\nYour Order #${params.orderId} has been completed successfully.\n${deliveryNote ? `\nDetails:\n${deliveryNote}\n` : ""}\nView your order: ${orderUrl}\n\nThank you for choosing GSM World.\n\n— GSM World Team`,
    html: layout(`Order #${params.orderId} has been completed and delivered.`, "#059669", h, body),
  };
}

// ── 8. Wallet top-up confirmation ─────────────────────────────────────────────

export function walletTopUpEmail(params: {
  customerName?: string | null;
  amount: string;
  newBalance: string;
}) {
  const name = params.customerName || "Valued Customer";
  const accountUrl = appUrl("/account");

  const h = header(
    "linear-gradient(135deg,#0f172a 0%,#0369a1 100%)",
    "Wallet Top-Up Confirmed",
    "Your GSM World wallet has been credited"
  );
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Your GSM World wallet has been successfully topped up. The funds are now available for use on your next purchase.</p>
    ${infoTable([
      ["Amount Added", `$${parseFloat(params.amount).toFixed(2)} USD`],
      ["New Wallet Balance", `$${parseFloat(params.newBalance).toFixed(2)} USD`],
    ])}
    ${btn("Go to My Account", accountUrl)}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;
  return {
    subject: "Wallet Top-Up Confirmed — GSM World",
    text: `Dear ${name},\n\nYour GSM World wallet has been topped up.\n\nAmount Added: $${parseFloat(params.amount).toFixed(2)} USD\nNew Balance: $${parseFloat(params.newBalance).toFixed(2)} USD\n\nManage your account: ${accountUrl}\n\n— GSM World Team`,
    html: layout(`Your wallet has been credited with $${parseFloat(params.amount).toFixed(2)} USD.`, "#0ea5e9", h, body),
  };
}

// ── NEW: Admin new-order alert ────────────────────────────────────────────────

export function adminNewOrderAlertEmail(params: {
  orderId: number;
  orderCode?: string | null;
  orderType: string;
  customerEmail: string;
  customerName?: string | null;
  items: string;
  total: string;
  paymentMethod: string;
}) {
  const ref = params.orderCode || String(params.orderId);
  const adminUrl = appUrl("/admin");
  const payLabel: Record<string, string> = {
    mpesa: "M-Pesa (STK Push)", wallet: "GSM World Wallet",
    nowpayments: "NOWPayments", binance_pay: "Binance",
    usdt_manual: "Digital Transfer", usdt: "Digital Currency Payment",
  };
  const pmLabel = payLabel[params.paymentMethod] ?? params.paymentMethod;
  const h = header(
    "linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%)",
    `New ${params.orderType} Order #${ref}`,
    `A new order has been placed on GSM World`
  );
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#475569;">A new order has just been placed and requires your attention.</p>
    ${infoTable([
      ["Order #", ref],
      ["Type", params.orderType],
      ["Customer", params.customerEmail],
      ["Item(s)", params.items],
      ["Total", `$${parseFloat(params.total).toFixed(2)} USD`],
      ["Payment Method", pmLabel],
    ])}
    ${btn("View in Admin Dashboard", adminUrl, "#1e3a5f")}
  `;
  return {
    subject: `New Order #${ref} — ${params.orderType} (${params.customerEmail})`,
    text: `New ${params.orderType} — Order #${ref}\n\nCustomer: ${params.customerEmail}\nItem(s): ${params.items}\nTotal: $${parseFloat(params.total).toFixed(2)}\nPayment: ${pmLabel}\n\nAdmin dashboard: ${adminUrl}`,
    html: layout(`New ${params.orderType} — Order #${ref} placed by ${params.customerEmail}.`, "#0ea5e9", h, body),
  };
}

// ── 9. Pending manual payment ─────────────────────────────────────────────────

export function pendingManualPaymentEmail(params: {
  orderId: number;
  orderCode?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  paymentMethod: string;
  total: string;
  binanceId?: string | null;
  usdtAddress?: string | null;
  whatsappContact?: string | null;
}) {
  const ref = params.orderCode || String(params.orderId);
  const name = params.customerName || "Valued Customer";
  const orderUrl = params.customerEmail
    ? appUrl(`/orders/lookup?orderId=${params.orderId}&email=${encodeURIComponent(params.customerEmail)}`)
    : appUrl(`/orders/${params.orderId}`);
  const isBinance = params.paymentMethod === "binance_pay";
  const isUsdt = params.paymentMethod === "usdt_manual";

  const methodLabel = isBinance ? "Binance" : isUsdt ? "Digital Transfer" : params.paymentMethod;

  const h = header(
    "linear-gradient(135deg,#1e1b4b 0%,#4338ca 100%)",
    "Complete Your Payment",
    `Manual payment instructions for Order #${ref}`
  );

  const paymentRows: Array<[string, string]> = [
    ["Order Reference", `#${ref}`],
    ["Amount Due", `$${parseFloat(params.total).toFixed(2)} USD`],
    ["Payment Method", methodLabel],
  ];
  if (isBinance && params.binanceId) paymentRows.push(["Binance Pay ID", params.binanceId]);
  if (isUsdt && params.usdtAddress) {
    paymentRows.push(["Wallet Address", params.usdtAddress]);
    paymentRows.push(["Network", "Tron Network"]);
  }

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Thank you for placing your order. To complete your purchase, please send the exact amount using the payment details below. Your order will be processed once our team confirms the transfer.</p>
    ${infoTable(paymentRows)}
    ${alertBox(
      "Important",
      `Send exactly $${parseFloat(params.total).toFixed(2)} USD. Always include your order reference ORDER-${ref} in the payment note or screenshot so we can match your payment quickly.`,
      "#4338ca",
      "#eef2ff"
    )}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">After sending payment, please <strong>upload a screenshot</strong> of your transaction via the order page below so our team can verify it promptly.</p>
    ${btn("Open Order & Upload Screenshot", orderUrl, "#4338ca")}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:13px;color:#94a3b8;">Payment verification typically takes 1–3 hours during business hours.${params.whatsappContact ? ` For assistance, message us on WhatsApp: <a href="https://wa.me/${params.whatsappContact}" style="color:#4338ca;">${params.whatsappContact}</a>` : " For urgent assistance, contact our support team."}</p>
      <p style="margin:12px 0 0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;
  return {
    subject: `Complete Your Order #${ref} — Payment Instructions | GSM World`,
    text: `Dear ${name},\n\nPlease complete your payment for Order #${ref}.\n\nAmount Due: $${parseFloat(params.total).toFixed(2)} USD\nMethod: ${methodLabel}${isBinance && params.binanceId ? `\nBinance Pay ID: ${params.binanceId}` : ""}${isUsdt && params.usdtAddress ? `\nWallet Address: ${params.usdtAddress}\nNetwork: Tron Network` : ""}\n\nAfter sending, upload your payment screenshot: ${orderUrl}\n\n— GSM World Team`,
    html: layout(`Payment instructions for Order #${ref} — please complete your transfer.`, "#4338ca", h, body),
  };
}


// ── Admin → User direct message notification ──────────────────────────────────

export function adminDirectMessageEmail(params: {
  customerName?: string | null;
  message: string;
}) {
  const name = params.customerName || "Valued Customer";
  const accountUrl = appUrl("/account");

  const h = header(
    "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    "Message from GSM World Support",
    "The support team has sent you a message"
  );
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">You have a new message from the GSM World support team:</p>
    ${alertBox("", params.message, "#0ea5e9", "#f0f9ff")}
    ${btn("View My Account", accountUrl)}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Support Team</strong></p>
    </div>
  `;
  return {
    subject: "New Message from GSM World Support",
    text: `Dear ${name},\n\nYou have a new message from GSM World Support:\n\n${params.message}\n\nView your account: ${accountUrl}\n\n— GSM World Team`,
    html: layout("You have a new message from the GSM World support team.", "#0ea5e9", h, body),
  };
}

// ── Announcement broadcast email ──────────────────────────────────────────────
export function announcementEmail(params: {
  subject: string;
  body: string;
  featuredProducts?: Array<{
    id: number;
    name: string;
    price: string;
    imageUrl: string | null;
    originalPrice?: string | null;
  }>;
}) {
  const storeUrl = getBaseUrl();

  // ── Product showcase strip (Jumia-style horizontal scroll) ────────────────
  function productCard(p: { id: number; name: string; price: string; imageUrl: string | null; originalPrice?: string | null }) {
    const productUrl = `${storeUrl}/products/${p.id}`;
    const imgSrc = p.imageUrl || `${storeUrl}/placeholder.png`;
    const oldPriceHtml = p.originalPrice ? `<p style="margin:0 0 2px;font-size:11px;color:#94a3b8;text-decoration:line-through;">${parseFloat(p.originalPrice).toFixed(2)}</p>` : "";
    const discount = p.originalPrice
      ? `<span style="display:inline-block;background:#ef4444;color:#fff;font-size:9px;font-weight:900;padding:2px 6px;border-radius:4px;margin-left:4px;">-${Math.round((1 - parseFloat(p.price)/parseFloat(p.originalPrice))*100)}%</span>`
      : "";
    // Use table cell with class product-cell — CSS makes it 46% wide on mobile
    return `<td class="product-cell" style="width:48%;vertical-align:top;padding-right:8px;padding-bottom:10px;">
      <a href="${productUrl}" style="text-decoration:none;display:block;background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
        <div style="width:100%;overflow:hidden;background:#f1f5f9;line-height:0;">
          <img src="${imgSrc}" width="260" height="160" style="width:100%;height:auto;display:block;object-fit:cover;" />
        </div>
        <div style="padding:10px 12px 13px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#0f172a;line-height:1.35;">${p.name}</p>
          ${oldPriceHtml}
          <p style="margin:0 0 10px;font-size:16px;font-weight:900;color:#0ea5e9;line-height:1;">${parseFloat(p.price).toFixed(2)}${discount}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:8px;text-align:center;padding:9px 0;">
                <a href="${productUrl}" style="color:#fff;font-size:12px;font-weight:900;text-decoration:none;letter-spacing:0.5px;">BUY NOW</a>
              </td>
            </tr>
          </table>
        </div>
      </a>
    </td>`;
  }

  // Build products in rows of 2 for a grid layout that works on both desktop and mobile
  function buildProductRows(products: typeof params.featuredProducts & object[]) {
    const rows: string[] = [];
    for (let i = 0; i < products.length; i += 2) {
      const pair = products.slice(i, i + 2);
      rows.push(`<tr>${pair.map(productCard).join("")}${pair.length === 1 ? `<td class="product-cell" style="width:48%;vertical-align:top;"></td>` : ""}</tr>`);
    }
    return rows.join("");
  }

  const productsHtml = (params.featuredProducts && params.featuredProducts.length > 0)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="padding:0 0 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><p style="margin:0;font-size:12px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;">Featured Products</p></td>
              <td style="text-align:right;"><a href="${storeUrl}/products" style="font-size:12px;color:#0ea5e9;font-weight:700;text-decoration:none;">View All →</a></td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table class="product-grid-table" role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${buildProductRows(params.featuredProducts)}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0 0;text-align:center;">
          <a href="${storeUrl}/products" style="display:inline-block;background:#0f172a;color:#fff;font-size:13px;font-weight:800;padding:13px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">Shop All Products</a>
        </td>
      </tr>
    </table>`
    : "";

  const h = header(
    "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    "GSM World Announcement",
    params.subject
  );
  const paragraphs = params.body
    .split(/\n+/)
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">${p}</p>`)
    .join("");
  const bodyHtml = `
    ${productsHtml}
    ${paragraphs}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;
  return layout(params.subject, "#0ea5e9", h, bodyHtml);
}

// ── Abandoned cart recovery email ─────────────────────────────────────────────
export function abandonedCartEmail(params: {
  customerName?: string | null;
  items: Array<{ productName: string; quantity: number; price: string; imageUrl?: string | null }>;
  total: number;
}) {
  const name = params.customerName || "there";
  const cartUrl = appUrl("/cart");
  const storeUrl = getBaseUrl();

  const itemRows = params.items
    .map(item => {
      const lineTotal = (parseFloat(item.price) * item.quantity).toFixed(2);
      const imgCell = item.imageUrl
        ? `<td style="width:60px;padding-right:12px;vertical-align:middle;"><img src="${item.imageUrl}" width="60" height="60" style="border-radius:10px;object-fit:cover;display:block;" /></td>`
        : "";
      return `<tr>
        <td style="padding:12px 20px;border-bottom:1px solid #f1f5f9;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            ${imgCell}
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">${item.productName}</p>
              <p style="margin:3px 0 0;font-size:12px;color:#64748b;">Qty: ${item.quantity}</p>
            </td>
            <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
              <p style="margin:0;font-size:14px;font-weight:800;color:#0f172a;">$${lineTotal}</p>
            </td>
          </tr></table>
        </td>
      </tr>`;
    })
    .join("");

  const h = header(
    "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
    "You Left Something Behind 👀",
    "Your cart is waiting for you"
  );

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">Hi <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;">You left some items in your cart — don't worry, we saved them for you.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;margin:0 0 20px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 20px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;">Your Saved Items</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr style="background:#eff6ff;">
          <td style="padding:14px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;font-weight:800;color:#0f172a;">Total</td>
              <td style="text-align:right;font-size:20px;font-weight:900;color:#0ea5e9;">$${params.total.toFixed(2)}</td>
            </tr></table>
          </td>
        </tr>
      </tbody>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 10px 10px 0;padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#9a3412;font-weight:600;">⚡ Items in your cart are in high demand and may sell out soon.</p>
        </td>
      </tr>
    </table>

    ${btn("Complete My Order →", cartUrl, "#0ea5e9")}

    <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
      Need help? <a href="${storeUrl}" style="color:#0ea5e9;text-decoration:none;font-weight:600;">Contact our support team</a>
    </p>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;

  const textItems = params.items
    .map(i => `  - ${i.productName} × ${i.quantity}  ($${(parseFloat(i.price) * i.quantity).toFixed(2)})`)
    .join("\n");

  return {
    subject: `Your GSM World cart is waiting — ${params.items.length === 1 ? "1 item" : `${params.items.length} items`} saved`,
    text: `Hi ${name},\n\nYou have items waiting in your GSM World cart:\n\n${textItems}\n\nTotal: $${params.total.toFixed(2)}\n\nComplete your order here: ${cartUrl}\n\n— GSM World Team`,
    html: layout("Your cart is waiting — complete your order before items sell out.", "#f97316", h, body),
  };
}

// ── Gift Card Delivery Email ───────────────────────────────────────────────────
export function giftCardDeliveryEmail(params: {
  orderId: number;
  customerName: string | null;
  productName: string;
  giftCardCode: string;
  denomination: string;
  orderUrl: string;
}): { subject: string; text: string; html: string } {
  const storeUrl = getBaseUrl();
  const name = params.customerName ?? "Customer";
  const h = `<h1 style="margin:0 0 6px;font-size:26px;font-weight:900;color:#0f172a;line-height:1.1;">Your Gift Card is Ready! 🎁</h1>
    <p style="margin:0;font-size:15px;color:#64748b;font-weight:500;">Order #${params.orderId} · ${params.productName}</p>`;

  const body = `
    <p style="margin:0 0 24px;font-size:15px;color:#475569;">Hi <strong style="color:#0f172a;">${name}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;">Your payment has been confirmed and your gift card is ready to use. Here are your details:</p>

    <!-- Gift Card Visual -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);border-radius:16px;padding:28px 24px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;">GSM World Gift Card</p>
          <p style="margin:0 0 16px;font-size:22px;font-weight:900;color:#ffffff;">${params.productName}</p>
          <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.7);font-weight:600;">Value</p>
          <p style="margin:0 0 20px;font-size:28px;font-weight:900;color:#ffffff;">${params.denomination}</p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="background:rgba(255,255,255,0.15);border:1.5px dashed rgba(255,255,255,0.5);border-radius:10px;padding:14px 24px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1.5px;">Your Code</p>
                <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:4px;font-family:'Courier New',Courier,monospace;">${params.giftCardCode}</p>
              </td>
            </tr>
          </table>

          <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,0.6);">Order #${params.orderId}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;margin:0 0 24px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:10px 20px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;">How to redeem</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:14px 20px 6px;font-size:14px;color:#475569;"><strong style="color:#0f172a;">1.</strong> Copy the code above</td></tr>
        <tr><td style="padding:4px 20px 6px;font-size:14px;color:#475569;"><strong style="color:#0f172a;">2.</strong> Visit the platform/store for <strong>${params.productName}</strong></td></tr>
        <tr><td style="padding:4px 20px 14px;font-size:14px;color:#475569;"><strong style="color:#0f172a;">3.</strong> Paste the code at checkout to apply the value</td></tr>
      </tbody>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">⚠️ Keep this code safe. Gift card codes can only be redeemed once and are non-refundable.</p>
        </td>
      </tr>
    </table>

    ${btn("View Order Details →", params.orderUrl, "#0ea5e9")}

    <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
      Need help? <a href="${storeUrl}" style="color:#0ea5e9;text-decoration:none;font-weight:600;">Contact our support team</a>
    </p>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:14px;color:#475569;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>
  `;

  return {
    subject: `🎁 Your Gift Card Code — ${params.productName} (Order #${params.orderId})`,
    text: `Hi ${name},\n\nYour gift card is ready!\n\n${params.productName}\nValue: ${params.denomination}\nCode: ${params.giftCardCode}\n\nKeep this code safe and redeem it on the relevant platform.\n\nView order: ${params.orderUrl}\n\n— GSM World Team`,
    html: layout("Your gift card code is ready to use!", "#0ea5e9", h, body),
  };
}
