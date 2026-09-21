export type Money = {
  amount: number;
  currency: string;
};

export type AgendaItem = {
  item_id: string;
  order_id: string;
  reference: string;
  client_name: string;
  description: string;
  status: string;
  due_date: string | null;
};

export type BootstrapResponse = {
  user: {
    id: string;
    fullName: string;
    phone: string;
    platformRoles?: string[];
  };
  workshop: {
    id: string;
    name: string;
    currency: string;
    countryCode: string;
    timezone: string;
    status: string;
    role: 'owner' | 'collaborator';
    canViewMoney: boolean;
  };
  capabilities: {
    canViewMoney: boolean;
    role: 'owner' | 'collaborator';
  };
  dashboard: {
    counts: {
      dueToday: number;
      dueWithinSevenDays: number;
      late: number;
      readyNotDelivered: number;
    };
    agenda: AgendaItem[];
    finance: {
      outstanding: Money;
      collectedThisMonth: Money;
    } | null;
  };
};
