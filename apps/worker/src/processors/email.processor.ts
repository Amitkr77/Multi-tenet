import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import * as nodemailer from "nodemailer";
import {
  QUEUE_NAMES,
  EMAIL_JOB_NAMES,
  type SendVerificationEmailJob,
  type SendPasswordResetEmailJob,
  type SendStaffInviteEmailJob,
  type SendOrderConfirmationEmailJob,
  type SendPaymentFailedEmailJob,
  type SendAccountSuspendedEmailJob,
  type SendDataExportReadyEmailJob,
  type SendDataDeletedEmailJob,
} from "@saas/shared-types";

/**
 * Local dev / Phase 1: SMTP transport pointed at Mailhog (docker-compose),
 * so verification/reset/invite emails are viewable at http://localhost:8025
 * without any real provider credentials. Production-shaped on purpose —
 * swapping to SES/SendGrid later is a change to this one function only,
 * no call-site changes.
 */
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    ignoreTLS: process.env.SMTP_IGNORE_TLS !== "false",
  });
}

/** Minimal but mobile-friendly HTML email shell using inline styles for broad client support. */
function emailLayout(opts: {
  preheader?: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const accentColor = process.env.EMAIL_ACCENT_COLOR ?? "#4f46e5";
  const brandName = process.env.EMAIL_BRAND_NAME ?? "SaaS Platform";

  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<tr><td align="center" style="padding:24px 0 8px;">
        <a href="${opts.ctaUrl}" target="_blank"
           style="display:inline-block;background:${accentColor};color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;">
          ${opts.ctaLabel}
        </a>
       </td></tr>`
    : "";

  const fallbackLink = opts.ctaUrl
    ? `<tr><td style="padding:4px 0 16px;text-align:center;font-family:sans-serif;font-size:12px;color:#71717a;">
        Or copy this link: <a href="${opts.ctaUrl}" style="color:${accentColor};word-break:break-all;">${opts.ctaUrl}</a>
       </td></tr>`
    : "";

  const footer = opts.footerNote
    ? `<tr><td style="padding-top:8px;font-family:sans-serif;font-size:12px;color:#a1a1aa;text-align:center;">${opts.footerNote}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
${opts.preheader ? `<!--[if !mso]><!--><div style="display:none;max-height:0;overflow:hidden;">${opts.preheader}</div><!--<![endif]-->` : ""}
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

      <!-- Header -->
      <tr><td style="background:${accentColor};padding:20px 32px;">
        <p style="margin:0;font-family:sans-serif;font-size:16px;font-weight:700;color:#ffffff;">${brandName}</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:sans-serif;font-size:20px;font-weight:700;color:#18181b;padding-bottom:16px;">${opts.heading}</td></tr>
          <tr><td style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#3f3f46;">${opts.body}</td></tr>
          ${cta}
          ${fallbackLink}
          ${footer}
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:16px 32px;background:#f9f9fb;border-top:1px solid #e4e4e7;font-family:sans-serif;font-size:11px;color:#a1a1aa;text-align:center;">
        You're receiving this email because an action was taken on your account.<br/>
        &copy; ${new Date().getFullYear()} ${brandName}
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

@Processor(QUEUE_NAMES.email)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly transport = createTransport();
  private readonly fromAddress =
    process.env.EMAIL_FROM ?? "no-reply@yourapp.dev";

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case EMAIL_JOB_NAMES.sendVerificationEmail: {
        const data = job.data as SendVerificationEmailJob;
        await this.transport.sendMail({
          from: this.fromAddress,
          to: data.toEmail,
          subject: "Verify your email address",
          html: emailLayout({
            preheader: "Confirm your email to finish setting up your account.",
            heading: "Verify your email",
            body: "Thanks for signing up! Click the button below to confirm your email address and activate your account.",
            ctaLabel: "Verify email",
            ctaUrl: data.verifyUrl,
            footerNote: "This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.",
          }),
        });
        break;
      }
      case EMAIL_JOB_NAMES.sendPasswordResetEmail: {
        const data = job.data as SendPasswordResetEmailJob;
        await this.transport.sendMail({
          from: this.fromAddress,
          to: data.toEmail,
          subject: "Reset your password",
          html: emailLayout({
            preheader: "Someone requested a password reset for your account.",
            heading: "Reset your password",
            body: "We received a request to reset your password. Click the button below to choose a new one.",
            ctaLabel: "Reset password",
            ctaUrl: data.resetUrl,
            footerNote: "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your account is not at risk.",
          }),
        });
        break;
      }
      case EMAIL_JOB_NAMES.sendStaffInviteEmail: {
        const data = job.data as SendStaffInviteEmailJob;
        await this.transport.sendMail({
          from: this.fromAddress,
          to: data.toEmail,
          subject: `You've been invited to join ${data.tenantName}`,
          html: emailLayout({
            preheader: `You have a pending invitation to ${data.tenantName}.`,
            heading: `You're invited to ${data.tenantName}`,
            body: `You've been invited to join the <strong>${data.tenantName}</strong> team. Accept your invitation to get started.`,
            ctaLabel: "Accept invitation",
            ctaUrl: data.acceptUrl,
            footerNote: "If you weren't expecting this invitation, you can safely ignore this email.",
          }),
        });
        break;
      }
      case EMAIL_JOB_NAMES.sendOrderConfirmationEmail: {
        const data = job.data as SendOrderConfirmationEmailJob;
        await this.transport.sendMail({
          from: this.fromAddress,
          to: data.toEmail,
          subject: `Order confirmed — ${data.tenantName}`,
          html: emailLayout({
            preheader: `Your order of $${data.grandTotal.toFixed(2)} is confirmed.`,
            heading: "Order confirmed!",
            body: `
              <p style="margin:0 0 12px;">Thanks for your order at <strong>${data.tenantName}</strong>. Your payment of <strong>$${data.grandTotal.toFixed(2)}</strong> was successful.</p>
              <p style="margin:0;">We'll send you another update when your order ships.</p>
            `,
            ctaLabel: "View order",
            ctaUrl: data.orderUrl,
          }),
        });
        break;
      }
      case EMAIL_JOB_NAMES.sendPaymentFailedEmail: {
        const data = job.data as SendPaymentFailedEmailJob;
        await this.transport.sendMail({
          from: this.fromAddress,
          to: data.toEmail,
          subject: `Action required: payment failed for ${data.tenantName}`,
          html: emailLayout({
            preheader: "Your payment didn't go through — update your billing to keep your store active.",
            heading: "Payment failed",
            body: `
              <p style="margin:0 0 12px;">Your latest payment for <strong>${data.tenantName}</strong> didn't go through.</p>
              <p style="margin:0 0 12px;">Please update your billing details before <strong>${data.gracePeriodEndsAt}</strong> to avoid having your account suspended.</p>
            `,
            ctaLabel: "Update billing",
            ctaUrl: data.invoiceUrl,
          }),
        });
        break;
      }
      case EMAIL_JOB_NAMES.sendAccountSuspendedEmail: {
        const data = job.data as SendAccountSuspendedEmailJob;
        await this.transport.sendMail({
          from: this.fromAddress,
          to: data.toEmail,
          subject: `${data.tenantName}'s account has been suspended`,
          html: emailLayout({
            preheader: "Your storefront is now unavailable to customers.",
            heading: "Account suspended",
            body: `
              <p style="margin:0 0 12px;"><strong>${data.tenantName}</strong>'s account has been suspended because a payment that failed wasn't resolved during the grace period.</p>
              <p style="margin:0;">Your storefront is currently unavailable to customers. Resolve your billing to reactivate it immediately.</p>
            `,
            ctaLabel: "Resolve billing",
            ctaUrl: data.billingUrl,
          }),
        });
        break;
      }
      case EMAIL_JOB_NAMES.sendDataExportReadyEmail: {
        const data = job.data as SendDataExportReadyEmailJob;
        await this.transport.sendMail({
          from: this.fromAddress,
          to: data.toEmail,
          subject: `Your data export for ${data.tenantName} is ready`,
          html: emailLayout({
            preheader: "Your requested data export is available to download.",
            heading: "Your data export is ready",
            body: `
              <p style="margin:0 0 12px;">Your requested data export for <strong>${data.tenantName}</strong> has been prepared and is ready to download.</p>
              <p style="margin:0;">This download link expires on <strong>${data.expiresAt}</strong>.</p>
            `,
            ctaLabel: "Download data",
            ctaUrl: data.downloadUrl,
          }),
        });
        break;
      }
      case EMAIL_JOB_NAMES.sendDataDeletedEmail: {
        const data = job.data as SendDataDeletedEmailJob;
        await this.transport.sendMail({
          from: this.fromAddress,
          to: data.toEmail,
          subject: `${data.tenantName}'s account and data have been deleted`,
          html: emailLayout({
            heading: "Account and data deleted",
            body: `
              <p style="margin:0;"><strong>${data.tenantName}</strong>'s account and all associated data have been permanently deleted, as scheduled following offboarding.</p>
            `,
          }),
        });
        break;
      }
      default:
        this.logger.warn(`Unknown email job name: ${job.name}`);
    }
  }
}
