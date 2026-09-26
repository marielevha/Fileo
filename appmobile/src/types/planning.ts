import type { ItemStatus } from './orders';

export type PlanningMember = {
  id: string;
  full_name: string;
  role: string;
};

export type PlanningItem = {
  item_id: string;
  order_id: string;
  workshop_id: string;
  reference: string;
  client_name: string;
  category: string;
  description: string;
  quantity: number;
  status: ItemStatus;
  explicit_due_date: string | null;
  effective_due_date: string | null;
  promised_date: string | null;
  fitting_date: string | null;
  delivered_at: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  row_version: number;
};

export type PlanningResponse = {
  items: PlanningItem[];
  members: PlanningMember[];
  truncated?: boolean;
};

export type PlanningStatusFilter = ItemStatus | 'active' | 'all';
export type PlanningAssigneeFilter = string | 'unassigned' | 'all';
