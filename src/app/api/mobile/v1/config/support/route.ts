import { mobileHandler, ok } from "@/lib/mobile/api";
import { getSupportContact } from "@/lib/repos/support-contact";

export const dynamic = "force-dynamic";

export async function GET() {
  return mobileHandler(async () => {
    const { email, app_version: appVersion, company_name: companyName } = await getSupportContact();
    return ok({ supportEmail: email, appVersion, companyName }, { headers: { "Cache-Control": "no-store" } });
  });
}
