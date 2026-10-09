export interface EventModel {
  id: string;
  name: string;
  code: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  status: string;
  _count?: { booths: number; bars: number; users: number };
}
export interface Booth {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  _count?: { bars: number };
}
export interface Bar {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  boothId?: string;
  booth?: { id: string; name: string } | null;
  clientUserId?: string | null;
  clientUser?: { id: string; name: string; email: string } | null;
}
export interface CupType {
  displayName?: string;
  ownerEventId?: string | null;
  baseTypeId?: string | null;
  ownerEvent?: { id: string; name: string; code: string } | null;
  id: string;
  name: string;
  code: string;
  capacityMl?: number;
  description?: string;
  active: boolean;
  cost?: number | null;
}
export type StockCondition = 'CLEAN' | 'DIRTY' | 'DAMAGED';
export type StockMovementType =
  | 'INITIAL_LOAD'
  | 'TRANSFER'
  | 'DELIVERY'
  | 'RETURN'
  | 'CLEANING_SEND'
  | 'CLEANING_RETURN'
  | 'ADJUSTMENT'
  | 'LOSS'
  | 'BREAKAGE';
export interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
  active: boolean;
}
export interface IncidentComment {
  id: string;
  message: string;
  createdAt: string;
  user: { id: string; name: string };
}
export interface IncidentItem {
  id: string;
  kind: 'INCIDENT' | 'NOTICE';
  type: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  title: string;
  description?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  assignedTo?: { id: string; name: string } | null;
  location?: { id: string; name: string; type: string } | null;
  comments: IncidentComment[];
}
export interface CentralWarehouseOverview {
  locations: Array<{ id: string; name: string; type: string; items: StockItem[] }>;
  movements: Array<{
    id: string;
    type: StockMovementType;
    createdAt: string;
    sourceLocation?: Location | null;
    destinationLocation?: Location | null;
    items: Array<{ quantity: number; condition: string; cupType: CupType }>;
    createdBy: { id: string; name: string; email: string };
  }>;
}
export interface StockItem {
  cupTypeId: string;
  cupTypeName: string;
  condition: string;
  quantity: number;
}
export interface StockSummary {
  cupTypeId: string;
  cupTypeName: string;
  clean: number;
  dirty: number;
  damaged: number;
  total: number;
}
export interface StockResponse {
  totals: StockItem[];
  summary: StockSummary[];
  locations?: Array<{ location: Location; items: StockItem[] }>;
}
export interface StockMovement {
  id: string;
  type: StockMovementType;
  status: string;
  notes?: string;
  createdAt: string;
  sourceLocation?: Location | null;
  destinationLocation?: Location | null;
  createdBy: { id: string; name: string; email: string };
  items: Array<{ cupTypeId: string; quantity: number; condition: string; cupType: CupType }>;
}
export type DeliveryNoteType = 'DELIVERY' | 'RETURN' | 'TRANSFER';
export type DeliveryNoteStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'CANCELLED';
export type SignatureType = 'DELIVERED_BY' | 'RECEIVED_BY';
export interface DeliveryNoteSignature {
  id: string;
  type: SignatureType;
  signerName: string;
  signedAt: string;
  imagePath: string;
}
export interface DeliveryNote {
  id: string;
  number: string;
  type: DeliveryNoteType;
  status: DeliveryNoteStatus;
  issuedAt?: string;
  createdAt: string;
  notes?: string;
  pdfAvailable?: boolean;
  signed?: boolean;
  signatureCount?: number;
  event?: EventModel;
  createdBy: { id: string; name: string; email: string };
  stockMovement: StockMovement;
  signatures: DeliveryNoteSignature[];
  emailLogs?: Array<{ recipient: string; subject: string; sentAt: string; status: string }>;
}
