export type ClientSort = 'name' | 'phone' | 'orders' | 'lastOrder' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export type Client = {
  id: string;
  workshop_id: string;
  display_name: string;
  phone_e164: string | null;
  phone_search: string | null;
  other_contact: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientListItem = Client & {
  order_count: number;
  last_order_at: string | null;
};

export type ClientPage = {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ClientInput = {
  displayName: string;
  phone: string | null;
  otherContact: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
};

export type Measurement = {
  id: string;
  client_id: string;
  category: string;
  version: number;
  values_json: string;
  unit: string;
  notes: string | null;
  taken_at: string;
  created_at: string;
  attachments: MeasurementAttachment[];
};

export type MeasurementAttachment = {
  id: string;
  measurement_record_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  signed_url: string | null;
  created_at: string;
};

export type MeasurementInput = {
  category: string;
  values: Record<string, number | null>;
  notes: string | null;
  takenAt: string | null;
};
