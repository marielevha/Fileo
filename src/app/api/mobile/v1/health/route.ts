import { ok } from '@/lib/mobile/api';

export const dynamic = 'force-dynamic';

export function GET() {
  return ok({ status: 'ok' });
}
