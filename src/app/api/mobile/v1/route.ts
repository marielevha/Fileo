import { ok } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({
    version: "v1",
    documentation: {
      swagger: "GET /api/mobile/v1/docs",
      openapi: "GET /api/mobile/v1/openapi.json",
    },
    auth: {
      login: "POST /api/mobile/v1/auth/login",
      refresh: "POST /api/mobile/v1/auth/refresh",
      register: "POST /api/mobile/v1/auth/register",
      requestOtp: "POST /api/mobile/v1/auth/otp/request",
      verifyOtp: "POST /api/mobile/v1/auth/otp/verify",
      forgotPassword: "POST /api/mobile/v1/auth/password/forgot",
      resetPassword: "POST /api/mobile/v1/auth/password/reset",
      logout: "POST /api/mobile/v1/auth/logout",
      me: "GET /api/mobile/v1/me",
    },
    resources: {
      supportContact: "GET /api/mobile/v1/config/support",
      faq: "GET /api/mobile/v1/faq?lang=fr",
      bootstrap: "GET /api/mobile/v1/bootstrap",
      clients: "GET/POST /api/mobile/v1/clients",
      client: "GET/PATCH/DELETE /api/mobile/v1/clients/{id}",
      clientArchive: "PATCH /api/mobile/v1/clients/{id}/archive",
      measurements: "GET/POST /api/mobile/v1/clients/{id}/measurements",
      measurementAttachments: "GET/POST /api/mobile/v1/clients/{id}/measurements/{measurementId}/attachments; DELETE /api/mobile/v1/clients/{id}/measurements/{measurementId}/attachments/{attachmentId}",
      orders: "GET/POST /api/mobile/v1/orders",
      order: "GET /api/mobile/v1/orders/{id}",
      orderClose: "POST /api/mobile/v1/orders/{id}/close",
      orderAttachments: "GET/POST /api/mobile/v1/orders/{id}/attachments; DELETE /api/mobile/v1/orders/{id}/attachments/{attachmentId}",
      planning: "GET /api/mobile/v1/planning",
      payments: "GET /api/mobile/v1/payments",
      recordPayment: "POST /api/mobile/v1/payments/record",
    },
  });
}
