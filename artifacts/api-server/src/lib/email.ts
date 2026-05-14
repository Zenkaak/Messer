import { logger } from "./logger";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function getBaseUrl() {
  return process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "gsmworld.vercel.app"}`;
}

export function appUrl(path: string) {
  const base = getBaseUrl().replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

// ── Shared layout ────────────────────────────────────────────────────────────

function layout(preheader: string, headerBg: string, headerContent: string, body: string) {
  const year = new Date().getFullYear();
  const storeUrl = "https://gsmworld.vercel.app";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>GSM World</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#eef2f7;line-height:1px;">${preheader}&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Logo -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin-bottom:16px;">
          <tr>
            <td align="center" style="padding:0 0 12px;">
              <a href="${storeUrl}" style="text-decoration:none;">
                <span style="font-size:26px;font-weight:900;color:#1a2332;letter-spacing:-0.5px;">GSM&nbsp;<span style="color:#2563eb;">World</span></span>
              </a>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.09);">
          <!-- Header -->
          <tr>
            <td style="background:${headerBg};padding:0;">
              ${headerContent}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;color:#334155;font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <!-- Footer divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:#e2e8f0;"></div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">You're receiving this because you have an account with GSM World.</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                <a href="${storeUrl}" style="color:#2563eb;text-decoration:none;">gsmworld.vercel.app</a>
                &nbsp;&middot;&nbsp;
                <a href="${storeUrl}/account" style="color:#2563eb;text-decoration:none;">Account Settings</a>
                &nbsp;&middot;&nbsp;
                <span>© ${year} GSM World</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function headerGradient(icon: string, title: string, subtitle: string, bg = "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)") {
  return `<div style="background:${bg};padding:32px 36px 28px;">
    <p style="margin:0 0 10px;font-size:36px;line-height:1;">${icon}</p>
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">${title}</h1>
    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.7);">${subtitle}</p>
  </div>`;
}

function btn(label: string, url: string, color = "#2563eb") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr>
      <td style="background:${color};border-radius:12px;">
        <a href="${url}" style="display:block;padding:14px 32px;font-size:14px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function statusBadge(icon: string, label: string, color: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto;">
    <tr>
      <td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px 32px;text-align:center;">
        <div style="font-size:40px;line-height:1;margin-bottom:8px;">${icon}</div>
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:4px;">Order Status</div>
        <div style="font-size:20px;font-weight:900;color:${color};">${label}</div>
      </td>
    </tr>
  </table>`;
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#64748b;width:40%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:700;color:#0f172a;text-align:right;">${value}</td>
  </tr>`;
}

function orderItemsTable(items: Array<{ productName: string; quantity: number; price: string }>, total: string) {
  const rows = items.map(i =>
    `<tr>
      <td style="padding:10px 0 10px 16px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${i.productName}</td>
      <td style="padding:10px 8px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:center;white-space:nowrap;">× ${i.quantity}</td>
      <td style="padding:10px 16px 10px 0;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;">$${(parseFloat(i.price) * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f8fafc;border-radius:14px;overflow:hidden;margin:20px 0;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:10px 0 10px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:left;">Service</th>
        <th style="padding:10px 8px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:center;">Qty</th>
        <th style="padding:10px 16px 10px 0;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#eff6ff;">
        <td colspan="2" style="padding:14px 8px 14px 16px;font-size:13px;font-weight:900;color:#1a2332;">Total</td>
        <td style="padding:14px 16px 14px 0;font-size:18px;font-weight:900;color:#2563eb;text-align:right;">$${parseFloat(total).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>`;
}

function noteBox(title: string, content: string, color = "#2563eb", bg = "#eff6ff") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr>
      <td style="background:${bg};border-left:4px solid ${color};border-radius:0 12px 12px 0;padding:14px 18px;">
        ${title ? `<p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${title}</p>` : ""}
        <p style="margin:0;font-size:14px;color:#0f172a;white-space:pre-line;line-height:1.6;">${content}</p>
      </td>
    </tr>
  </table>`;
}

// ── Email sender ─────────────────────────────────────────────────────────────

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

  if (!emailFrom || !smtpHost) {
    logger.info({ to: message.to, subject: message.subject }, "Email skipped: SMTP not configured");
    return { sent: false, reason: "SMTP not configured" };
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: smtpHost,
    port: Number(smtpPort || 587),
    secure: smtpSecure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  await transporter.sendMail({
    from: `GSM World <${emailFrom}>`,
    replyTo: emailFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    headers: {
      "X-Entity-Ref-ID": `gsm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      "X-Mailer": "GSM World Mailer",
      "Precedence": "bulk",
      "List-Unsubscribe": `<mailto:${emailFrom}?subject=unsubscribe>`,
    },
  });

  logger.info({ to: message.to, subject: message.subject }, "Email sent");
  return { sent: true };
}

// ── 1. OTP / Verification code ───────────────────────────────────────────────

export function otpEmail(code: string) {
  const header = headerGradient("🔐", "Verify Your Email", "One-time verification code for GSM World");
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Welcome to <strong>GSM World</strong>! Enter the code below to verify your email address and activate your account.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:16px;padding:28px 24px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Verification Code</p>
          <p style="margin:0;font-size:48px;font-weight:900;color:#1a2332;letter-spacing:14px;font-family:monospace;">${code}</p>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#64748b;">⏱ This code expires in <strong>10 minutes</strong>. Never share it with anyone — GSM World staff will never ask for your code.</p>
  `;
  return {
    subject: "Your GSM World Verification Code",
    text: `Your GSM World verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: layout(`Your verification code is: ${code}`, "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)", header, body),
  };
}

// ── 2. Login notification ────────────────────────────────────────────────────

export function loginNotificationEmail(name: string | null, meta?: { ip?: string; device?: string }) {
  const displayName = name || "there";
  const time = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  const securityUrl = appUrl("/account/security");

  const header = headerGradient("🔔", "New Sign-In Detected", "Security alert for your GSM World account", "linear-gradient(135deg,#1e3a5f 0%,#1a2332 100%)");
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi <strong>${displayName}</strong>,</p>
    <p style="margin:0 0 20px;color:#334155;">A successful sign-in was just recorded on your <strong>GSM World</strong> account.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;margin:0 0 20px;overflow:hidden;">
      <tbody>
        ${infoRow("Date &amp; Time", time)}
        ${meta?.ip ? infoRow("IP Address", meta.ip) : ""}
        ${meta?.device ? infoRow("Device", meta.device) : ""}
      </tbody>
    </table>
    <p style="margin:0 0 8px;color:#334155;font-size:14px;"><strong>Was this you?</strong> No action is needed.</p>
    <p style="margin:0 0 20px;color:#334155;font-size:14px;"><strong>Wasn't you?</strong> Secure your account immediately by changing your password.</p>
    ${btn("🔒 Secure My Account →", securityUrl, "#dc2626")}
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">If you have trouble, contact our support team via WhatsApp or the help chat on the website.</p>
  `;
  return {
    subject: "New Sign-In to Your GSM World Account",
    text: `Hi ${displayName},\n\nA new sign-in was detected on your GSM World account at ${time}.\n\nIf this was NOT you, secure your account immediately: ${securityUrl}\n\n— GSM World Security Team`,
    html: layout(`New sign-in detected on your GSM World account at ${time}`, "linear-gradient(135deg,#1e3a5f 0%,#1a2332 100%)", header, body),
  };
}

// ── 3. Order submitted confirmation ─────────────────────────────────────────

export function orderSubmittedEmail(params: {
  orderId: number;
  customerName?: string | null;
  items: Array<{ productName: string; quantity: number; price: string }>;
  total: string;
  paymentMethod: string;
}) {
  const name = params.customerName || "Customer";
  const orderUrl = appUrl(`/orders/${params.orderId}`);
  const payLabel: Record<string, string> = {
    mpesa: "M-Pesa (STK Push)",
    wallet: "GSM World Wallet",
    nowpayments: "Crypto via NOWPayments",
    usdt: "USDT",
    binance_pay: "Binance Pay (Manual)",
    usdt_manual: "USDT TRC20 (Manual Transfer)",
  };
  const pmLabel = payLabel[params.paymentMethod] ?? params.paymentMethod;

  const header = headerGradient("📦", `Order #${params.orderId} Received`, "We've got your order and it's being reviewed");
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 4px;color:#334155;">Thank you for your order! Here's a summary of what you purchased:</p>
    ${orderItemsTable(params.items, params.total)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;margin:0 0 20px;overflow:hidden;">
      <tbody>
        ${infoRow("Order ID", `#${params.orderId}`)}
        ${infoRow("Payment Method", pmLabel)}
        ${infoRow("Status", "Processing")}
      </tbody>
    </table>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;">Our team will review and process your order. You'll receive another email when the status changes. Average processing time is <strong>1–24 hours</strong>.</p>
    ${btn("📋 Track My Order →", orderUrl)}
    <p style="margin:24px 0 0;font-size:13px;color:#64748b;">Keep your order number handy: <strong>#${params.orderId}</strong></p>
  `;
  const textItems = params.items.map(i => `• ${i.productName} × ${i.quantity}  —  $${(parseFloat(i.price) * i.quantity).toFixed(2)}`).join("\n");
  return {
    subject: `Order #${params.orderId} Confirmed - GSM World`,
    text: `Hi ${name},\n\nYour order #${params.orderId} has been received!\n\n${textItems}\n\nTotal: $${parseFloat(params.total).toFixed(2)}\nPayment: ${pmLabel}\n\nTrack your order: ${orderUrl}\n\n— GSM World Team`,
    html: layout(`Order #${params.orderId} received — we're on it!`, "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)", header, body),
  };
}

// ── 4. Payment confirmed ─────────────────────────────────────────────────────

export function paymentConfirmedEmail(params: {
  orderId: number;
  customerName?: string | null;
  amount: string;
  paymentMethod: string;
  transactionRef?: string | null;
}) {
  const name = params.customerName || "Customer";
  const orderUrl = appUrl(`/orders/${params.orderId}`);
  const payLabel: Record<string, string> = {
    mpesa: "M-Pesa",
    wallet: "GSM World Wallet",
    nowpayments: "Crypto (NOWPayments)",
    binance_pay: "Binance Pay",
    usdt_manual: "USDT TRC20",
  };
  const pmLabel = payLabel[params.paymentMethod] ?? params.paymentMethod;
  const paidAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

  const header = headerGradient("✅", "Payment Confirmed!", "Your payment has been verified successfully", "linear-gradient(135deg,#14532d 0%,#16a34a 100%)");
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 20px;color:#334155;">Great news — your payment for <strong>Order #${params.orderId}</strong> has been confirmed. Your order is now being processed!</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;margin:0 0 20px;overflow:hidden;">
      <tbody>
        ${infoRow("Order ID", `#${params.orderId}`)}
        ${infoRow("Amount Paid", `$${parseFloat(params.amount).toFixed(2)} USD`)}
        ${infoRow("Payment Method", pmLabel)}
        ${infoRow("Confirmed At", paidAt)}
        ${params.transactionRef ? infoRow("Reference", params.transactionRef) : ""}
      </tbody>
    </table>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;">We're now working on your order. You'll receive another email when it's completed, usually within <strong>1–24 hours</strong>.</p>
    ${btn("📋 View My Order →", orderUrl, "#16a34a")}
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">Save this email as your payment receipt. Reference: ORDER-${params.orderId}</p>
  `;
  return {
    subject: `Payment Confirmed: Order #${params.orderId} - GSM World`,
    text: `Hi ${name},\n\nYour payment of $${parseFloat(params.amount).toFixed(2)} for Order #${params.orderId} has been confirmed via ${pmLabel} at ${paidAt}.\n\nYour order is now being processed. Track it at: ${orderUrl}\n\n— GSM World Team`,
    html: layout(`Payment confirmed for Order #${params.orderId}`, "linear-gradient(135deg,#14532d 0%,#16a34a 100%)", header, body),
  };
}

// ── 5. Order status update ───────────────────────────────────────────────────

export function orderStatusUpdateEmail(params: {
  orderId: number;
  customerName?: string | null;
  status: string;
  notes?: string | null;
}) {
  const name = params.customerName || "Customer";
  const orderUrl = appUrl(`/orders/${params.orderId}`);
  const statusMap: Record<string, { label: string; color: string; icon: string; bg: string }> = {
    paid:                         { label: "Payment Confirmed",             color: "#16a34a", icon: "✅", bg: "linear-gradient(135deg,#14532d 0%,#16a34a 100%)" },
    processing:                   { label: "Processing Your Order",         color: "#2563eb", icon: "⚙️", bg: "linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)" },
    pending:                      { label: "Pending Review",                color: "#d97706", icon: "⏳", bg: "linear-gradient(135deg,#92400e 0%,#d97706 100%)" },
    pending_payment_confirmation: { label: "Awaiting Payment Verification", color: "#7c3aed", icon: "🔍", bg: "linear-gradient(135deg,#4c1d95 0%,#7c3aed 100%)" },
    completed:                    { label: "Order Completed",               color: "#16a34a", icon: "🎉", bg: "linear-gradient(135deg,#14532d 0%,#16a34a 100%)" },
    failed:                       { label: "Order Failed",                  color: "#dc2626", icon: "❌", bg: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%)" },
    refunded:                     { label: "Order Refunded",                color: "#64748b", icon: "↩️", bg: "linear-gradient(135deg,#334155 0%,#64748b 100%)" },
  };
  const st = statusMap[params.status] ?? { label: params.status, color: "#1a2332", icon: "📋", bg: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" };

  const header = headerGradient(st.icon, `Order #${params.orderId} Update`, st.label, st.bg);
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 4px;color:#334155;">There's an update on your <strong>Order #${params.orderId}</strong>.</p>
    ${statusBadge(st.icon, st.label, st.color)}
    ${params.notes ? noteBox("Update Details", params.notes, st.color, "#f8fafc") : ""}
    ${btn("📋 View Full Order →", orderUrl)}
    <p style="margin:20px 0 0;font-size:13px;color:#64748b;">Questions? Reply to this email or contact us via WhatsApp.</p>
  `;
  return {
    subject: `Order #${params.orderId} Update: ${st.label} - GSM World`,
    text: `Hi ${name},\n\nYour Order #${params.orderId} has been updated.\n\nNew Status: ${st.label}\n${params.notes ? `\nDetails: ${params.notes}\n` : ""}\nTrack your order: ${orderUrl}\n\n— GSM World Team`,
    html: layout(`Order #${params.orderId} status: ${st.label}`, st.bg, header, body),
  };
}

// ── 6. More info needed (with file submit button) ────────────────────────────

export function moreInfoNeededEmail(params: {
  orderId: number;
  customerName?: string | null;
  message: string;
}) {
  const name = params.customerName || "Customer";
  const orderUrl = appUrl(`/orders/${params.orderId}`);

  const header = headerGradient("📋", "Action Required", `We need more info to complete Order #${params.orderId}`, "linear-gradient(135deg,#78350f 0%,#d97706 100%)");
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 20px;color:#334155;">Our team needs a bit more information to complete <strong>Order #${params.orderId}</strong>. Please review the message below and respond as soon as possible.</p>
    ${noteBox("Message from GSM World Team", params.message, "#d97706", "#fffbeb")}
    <p style="margin:16px 0;color:#334155;font-size:14px;"><strong>How to respond:</strong></p>
    <p style="margin:0 0 6px;color:#334155;font-size:14px;">1. Click the button below to open your order</p>
    <p style="margin:0 0 6px;color:#334155;font-size:14px;">2. Use the <strong>"Reply / Upload File"</strong> section to send us your information or attach any required files</p>
    <p style="margin:0 0 20px;color:#334155;font-size:14px;">3. Our team will respond promptly once received</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
      <tr>
        <td style="background:#d97706;border-radius:12px;">
          <a href="${orderUrl}" style="display:block;padding:14px 32px;font-size:14px;font-weight:800;color:#ffffff;text-decoration:none;">📎 Open Order &amp; Submit Files →</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#64748b;">Accepted file types: images, PDFs, screenshots. If you have trouble, contact us via WhatsApp.</p>
  `;
  return {
    subject: `Action Required: Order #${params.orderId} Needs More Information - GSM World`,
    text: `Hi ${name},\n\nWe need more information to complete Order #${params.orderId}.\n\nMessage:\n${params.message}\n\nPlease respond and/or upload files at: ${orderUrl}\n\n— GSM World Team`,
    html: layout(`Action required for Order #${params.orderId}`, "linear-gradient(135deg,#78350f 0%,#d97706 100%)", header, body),
  };
}

// ── 7. Order completed ───────────────────────────────────────────────────────

export function orderCompletedEmail(params: {
  orderId: number;
  customerName?: string | null;
  items: Array<{ productName: string; quantity: number; price: string }>;
  total: string;
  notes?: string | null;
}) {
  const name = params.customerName || "Customer";
  const orderUrl = appUrl(`/orders/${params.orderId}`);

  const header = headerGradient("🎉", "Your Order is Complete!", `Order #${params.orderId} has been delivered successfully`, "linear-gradient(135deg,#14532d 0%,#16a34a 100%)");
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 4px;color:#334155;">Your order has been fully processed and delivered. Here's a summary:</p>
    ${orderItemsTable(params.items, params.total)}
    ${params.notes ? noteBox("Delivery Details / Result", params.notes, "#16a34a", "#f0fdf4") : ""}
    ${btn("📋 View Full Order →", orderUrl, "#16a34a")}
    <p style="margin:24px 0 0;text-align:center;">
      <span style="display:inline-block;background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:12px 20px;font-size:13px;font-weight:700;color:#713f12;">
        ⭐ Thank you for choosing GSM World! We hope to serve you again.
      </span>
    </p>
  `;
  const textItems = params.items.map(i => `• ${i.productName} × ${i.quantity}`).join("\n");
  return {
    subject: `Order #${params.orderId} Completed - GSM World`,
    text: `Hi ${name},\n\nYour order #${params.orderId} has been completed!\n\n${textItems}\n\n${params.notes ? `Result:\n${params.notes}\n\n` : ""}View your order: ${orderUrl}\n\nThank you for choosing GSM World!\n— GSM World Team`,
    html: layout(`Order #${params.orderId} completed — thank you!`, "linear-gradient(135deg,#14532d 0%,#16a34a 100%)", header, body),
  };
}

// ── 8. Pending manual payment ────────────────────────────────────────────────

export function pendingManualPaymentEmail(params: {
  orderId: number;
  customerName?: string | null;
  paymentMethod: string;
  total: string;
  binanceId?: string;
  usdtAddress?: string;
}) {
  const name = params.customerName || "Customer";
  const orderUrl = appUrl(`/orders/${params.orderId}`);
  const isBinance = params.paymentMethod === "binance_pay";
  const methodTitle = isBinance ? "Binance Pay" : "USDT TRC20";

  const paymentDetails = isBinance
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;margin:16px 0;overflow:hidden;">
        <tbody>
          ${infoRow("Binance Pay ID", `<strong style="font-size:18px;letter-spacing:2px;">${params.binanceId}</strong>`)}
          ${infoRow("Reference / Memo", `ORDER-${params.orderId}`)}
          ${infoRow("Amount to Send", `$${parseFloat(params.total).toFixed(2)} USD`)}
        </tbody>
       </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;margin:16px 0;overflow:hidden;">
        <tbody>
          ${infoRow("Network", "TRON (TRC20)")}
          ${infoRow("Amount to Send", `$${parseFloat(params.total).toFixed(2)} USDT`)}
        </tbody>
       </table>
       <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Wallet Address</p>
       <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-family:monospace;font-size:13px;color:#0f172a;word-break:break-all;">${params.usdtAddress}</div>`;

  const header = headerGradient("⏳", `Order #${params.orderId} — Awaiting Payment`, `Please send your payment via ${methodTitle}`, "linear-gradient(135deg,#4c1d95 0%,#7c3aed 100%)");
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 16px;color:#334155;">Your order has been received! Please complete your payment using the details below:</p>
    ${paymentDetails}
    ${noteBox("Important", `Always include reference <strong>ORDER-${params.orderId}</strong> in your payment memo so we can match your payment quickly.`, "#d97706", "#fffbeb")}
    <p style="margin:16px 0 8px;font-size:14px;font-weight:700;color:#0f172a;">What happens next:</p>
    <p style="margin:0 0 4px;font-size:14px;color:#334155;">1️⃣ &nbsp;Send the exact amount above</p>
    <p style="margin:0 0 4px;font-size:14px;color:#334155;">2️⃣ &nbsp;Our team verifies your payment (within 24 hours)</p>
    <p style="margin:0 0 20px;font-size:14px;color:#334155;">3️⃣ &nbsp;Your order is processed &amp; result delivered by email</p>
    ${btn("📋 View My Order →", orderUrl, "#7c3aed")}
  `;
  return {
    subject: `Order #${params.orderId}: Complete Your Payment via ${methodTitle} - GSM World`,
    text: `Hi ${name},\n\nOrder #${params.orderId} received. Please pay $${parseFloat(params.total).toFixed(2)} via ${methodTitle}.\n\n${isBinance ? `Binance ID: ${params.binanceId}` : `USDT TRC20 Address: ${params.usdtAddress}`}\nReference: ORDER-${params.orderId}\n\nOur team verifies within 24 hours.\n\nView order: ${orderUrl}\n— GSM World Team`,
    html: layout(`Send payment for Order #${params.orderId} via ${methodTitle}`, "linear-gradient(135deg,#4c1d95 0%,#7c3aed 100%)", header, body),
  };
}
