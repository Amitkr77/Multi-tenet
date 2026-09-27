import { EMAIL_JOB_NAMES } from "@saas/shared-types";

const sendMail = jest.fn().mockResolvedValue(undefined);
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail })),
}));

// Imported after the mock so EmailProcessor's module-level `createTransport()`
// call (in its class field initializer) picks up the mocked nodemailer.
import { EmailProcessor } from "./email.processor";

describe("EmailProcessor", () => {
  let processor: EmailProcessor;

  beforeEach(() => {
    sendMail.mockClear();
    processor = new EmailProcessor();
  });

  it("sends a verification email with the correct subject and link", async () => {
    await processor.process({
      name: EMAIL_JOB_NAMES.sendVerificationEmail,
      data: { toEmail: "a@b.com", verifyUrl: "http://x/verify?token=1" },
    } as any);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe("a@b.com");
    expect(call.subject).toBe("Verify your email address");
    expect(call.html).toContain("http://x/verify?token=1");
  });

  it("sends a password reset email", async () => {
    await processor.process({
      name: EMAIL_JOB_NAMES.sendPasswordResetEmail,
      data: { toEmail: "a@b.com", resetUrl: "http://x/reset?token=2" },
    } as any);

    const call = sendMail.mock.calls[0][0];
    expect(call.subject).toBe("Reset your password");
    expect(call.html).toContain("http://x/reset?token=2");
  });

  it("sends a staff invite email with the tenant name in the subject", async () => {
    await processor.process({
      name: EMAIL_JOB_NAMES.sendStaffInviteEmail,
      data: {
        toEmail: "a@b.com",
        tenantName: "Acme Inc",
        acceptUrl: "http://x/accept?token=3",
      },
    } as any);

    const call = sendMail.mock.calls[0][0];
    expect(call.subject).toBe("You've been invited to join Acme Inc");
    expect(call.html).toContain("http://x/accept?token=3");
  });

  it("sends an order confirmation email with the order total", async () => {
    await processor.process({
      name: EMAIL_JOB_NAMES.sendOrderConfirmationEmail,
      data: {
        toEmail: "a@b.com",
        orderId: "order-1",
        tenantName: "Acme Inc",
        grandTotal: 42.5,
        orderUrl: "http://x/orders/order-1",
      },
    } as any);

    const call = sendMail.mock.calls[0][0];
    expect(call.subject).toBe("Order confirmed — Acme Inc");
    expect(call.html).toContain("$42.50");
    expect(call.html).toContain("http://x/orders/order-1");
  });

  it("sends a payment failed email with the invoice link and grace period", async () => {
    await processor.process({
      name: EMAIL_JOB_NAMES.sendPaymentFailedEmail,
      data: {
        toEmail: "a@b.com",
        tenantName: "Acme Inc",
        invoiceUrl: "http://x/invoice/in_1",
        gracePeriodEndsAt: "2026-08-12",
      },
    } as any);

    const call = sendMail.mock.calls[0][0];
    expect(call.subject).toBe("Action required: payment failed for Acme Inc");
    expect(call.html).toContain("http://x/invoice/in_1");
    expect(call.html).toContain("2026-08-12");
  });

  it("sends an account suspended email with a link to resolve billing", async () => {
    await processor.process({
      name: EMAIL_JOB_NAMES.sendAccountSuspendedEmail,
      data: {
        toEmail: "a@b.com",
        tenantName: "Acme Inc",
        billingUrl: "http://x/dashboard/settings/billing",
      },
    } as any);

    const call = sendMail.mock.calls[0][0];
    expect(call.subject).toBe("Acme Inc's account has been suspended");
    expect(call.html).toContain("http://x/dashboard/settings/billing");
  });

  it("sends a data export ready email with the download link and expiry", async () => {
    await processor.process({
      name: EMAIL_JOB_NAMES.sendDataExportReadyEmail,
      data: {
        toEmail: "a@b.com",
        tenantName: "Acme Inc",
        downloadUrl: "http://minio/exports/req-1.json?sig=abc",
        expiresAt: "2026-08-13T00:00:00.000Z",
      },
    } as any);

    const call = sendMail.mock.calls[0][0];
    expect(call.subject).toBe("Your data export for Acme Inc is ready");
    expect(call.html).toContain("http://minio/exports/req-1.json?sig=abc");
    expect(call.html).toContain("2026-08-13T00:00:00.000Z");
  });

  it("sends a data deleted confirmation email", async () => {
    await processor.process({
      name: EMAIL_JOB_NAMES.sendDataDeletedEmail,
      data: { toEmail: "a@b.com", tenantName: "Acme Inc" },
    } as any);

    const call = sendMail.mock.calls[0][0];
    expect(call.subject).toBe("Acme Inc's account and data have been deleted");
    expect(call.html).toContain("permanently deleted");
  });

  it("does nothing (no throw) for an unrecognized job name", async () => {
    await expect(
      processor.process({ name: "some-unknown-job", data: {} } as any),
    ).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
