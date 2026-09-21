import type { Money } from './dashboard';

export type ItemStatus = 'a_realiser' | 'en_cours' | 'a_essayer' | 'pret' | 'remis' | 'annule';
export type OrderState = 'nouvelle' | 'en_cours' | 'prete' | 'partiellement_remise' | 'remise' | 'annulee';
export type OrderFilter = 'all' | 'late' | OrderState;

export type OrderItem = {
  id: string;
  order_id: string;
  category: string;
  description: string;
  work_type: 'creation' | 'retouche' | null;
  wearer_name: string | null;
  wearer_relation: string | null;
  quantity: number;
  unit_price_amount: number;
  currency: string;
  status: ItemStatus;
  due_date: string | null;
  delivered_quantity: number;
  assignee_user_id: string | null;
  measurement_snapshot: string | null;
  row_version: number;
};

export type OrderSummary = {
  order: {
    id: string;
    workshop_id: string;
    client_id: string;
    client_name: string;
    reference: string;
    currency: string;
    discount_amount: number;
    discount_reason: string | null;
    instructions: string | null;
    promised_date: string | null;
    fitting_date: string | null;
    cancelled_at: string | null;
    created_at: string;
  };
  items: OrderItem[];
  state: OrderState;
  balance: {
    orderTotal: Money;
    appliedDiscount: Money;
    netCollected: Money;
    signedBalance: Money;
    remainingDue: Money;
    overpayment: Money;
  } | null;
  isLate: boolean;
};

export type OrderPage = {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type OrderMovement = {
  id: string;
  kind: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  effective_date: string;
  status: string;
};

export type OrderAttachment = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  signed_url: string | null;
  created_at: string;
};

export type OrderDetail = OrderSummary & {
  movements: OrderMovement[];
  attachments: OrderAttachment[];
};

export type ClientOption = {
  id: string;
  display_name: string;
  phone_e164: string | null;
};

export type CreateOrderRequest = {
  clientId?: string;
  client?: { displayName: string; phone?: string | null };
  promisedDate?: string | null;
  fittingDate?: string | null;
  instructions?: string | null;
  orderTotalAmount?: number;
  items: Array<{
    category: string;
    description: string;
    workType: 'creation' | 'retouche';
    wearerName?: string | null;
    quantity: number;
    unitPriceAmount: number;
    dueDate?: string | null;
    measurementValues?: Record<string, string>;
    measurementNotes?: string | null;
  }>;
  initialPayment?: {
    amount: number;
    method: 'cash' | 'mobile_money' | 'transfer' | 'other';
    reference?: string | null;
    effectiveDate: string;
    idempotencyKey: string;
  } | null;
};
