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
      logout: "POST /api/mobile/v1/auth/logout",
      me: "GET /api/mobile/v1/me",
    },
    resources: {
      bootstrap: "GET /api/mobile/v1/bootstrap",
      clients: "GET/POST /api/mobile/v1/clients",
      client: "GET/PATCH/DELETE /api/mobile/v1/clients/{id}",
      measurements: "GET/POST /api/mobile/v1/clients/{id}/measurements",
      orders: "GET/POST /api/mobile/v1/orders",
      order: "GET /api/mobile/v1/orders/{id}",
      orderAttachments: "GET/POST /api/mobile/v1/orders/{id}/attachments",
      planning: "GET /api/mobile/v1/planning",
      payments: "GET /api/mobile/v1/payments",
      recordPayment: "POST /api/mobile/v1/payments/record",
    },
  });
}
