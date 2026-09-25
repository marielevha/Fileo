export type WorkshopDetails = {
  name: string;
  city: string | null;
  country_code: string;
  currency: string;
  timezone: string;
  measurement_units_json?: string | string[];
};

export type TeamMember = {
  membership_id: string;
  user_id: string;
  full_name: string;
  phone_e164: string;
  role: 'owner' | 'collaborator';
  can_view_money: boolean;
  status: 'active' | 'disabled' | 'invited';
  assigned_items: number;
};

export type TeamPage = {
  members: TeamMember[];
  page: number;
  pageCount: number;
  stats: { active: number; owners: number; moneyAccess: number };
  planUsage: { planLabel: string | null; memberLimit: number | null; activeMembers: number; remainingSlots: number | null; limitReached: boolean };
};

export type Plan = {
  id: string;
  label: string;
  period_months: number;
  price: { amount: number; currency: string };
  basePrice?: { amount: number; currency: string };
  affiliateBenefit?: { eligible: boolean; discountRateBp: number; label: string | null };
  limits: { members: number | null; orders: number | null; storageMb: number | null; templates: number | null; notifications: boolean };
};

export type SubscriptionOverview = {
  subscription: { status: string; current_period_end: string | null } | null;
  currentPlan: Plan | null;
  availablePlans: Plan[];
  usage: { activeMembers: number; memberLimit: number | null };
  affiliateBenefit?: { eligible: boolean; discountRateBp: number; label: string | null };
  payments: Array<{ id: string; amount: number; currency: string; channel: string; external_reference: string | null; status: string; declared_at: string; plan_label: string | null }>;
};
