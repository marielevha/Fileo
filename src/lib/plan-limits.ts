export type PlanLimits = {
  members: number | null;
  storageMb: number | null;
  orders: number | null;
  templates: number | null;
  notifications: boolean;
};

export function parseLimits(raw: string): PlanLimits {
  try {
    const p = JSON.parse(raw) as Partial<PlanLimits>;
    return {
      members: p.members ?? null,
      storageMb: p.storageMb ?? null,
      orders: p.orders ?? null,
      templates: p.templates ?? null,
      notifications: p.notifications === true,
    };
  } catch {
    return { members: null, storageMb: null, orders: null, templates: null, notifications: false };
  }
}
