export interface DashboardGlobal {
  events: { active: number; planned: number; finished: number };
  stock: { clean: number; dirty: number; damaged: number; inCirculation: number };
  deliveryNotes: { pendingSignature: number };
  incidents: { open: number };
  cash: {
    balance: number;
    collections: number;
    expenses: number;
    withdrawals: number;
    differences: number;
    sessions: { available: boolean; open: number; closed: number };
  };
  alerts: Array<{ type: string; severity: string; title: string; message: string }>;
}
export interface EventDashboard {
  event: { id: string; name: string; code: string; status: string };
  structure: { booths: number; bars: number; users: number };
  stock: {
    clean: number;
    dirty: number;
    damaged: number;
    total: number;
    circulation: number;
    losses: number;
    breakages: number;
    byCup: Array<{
      cupTypeName: string;
      cupTypeCode: string;
      clean: number;
      dirty: number;
      damaged: number;
      total: number;
    }>;
    byLocation: Array<{
      location: { id: string; name: string; type: string };
      total: number;
      items: Array<{ cupTypeName: string; condition: string; quantity: number }>;
    }>;
  };
  deliveryNotes: {
    total: number;
    pendingSignature: number;
    signed: number;
    cancelled: number;
    pending: Array<{ id: string; number: string; missingSignatures: string[] }>;
  };
  cash: {
    balance: number;
    collections: number;
    expenses: number;
    withdrawals: number;
    differences: number;
    sessions: { available: boolean; open: number; closed: number };
  } | null;
  alerts: Array<{
    type: string;
    severity: string;
    title: string;
    message: string;
    entityId: string;
  }>;
  recentActivity: Array<{ type: string; id: string; at: string; title: string; detail: string }>;
  incidents: Array<{ id: string; title: string; status: string }>;
}
