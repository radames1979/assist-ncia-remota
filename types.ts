
export type UserRole = 'admin' | 'client' | 'tech';

export interface User {
  uid: string;
  email: string;
  name?: string;
  phone?: string;
  role: UserRole;
  status: 'active' | 'suspended';
  createdAt: number;
  rating?: number;
  totalRatings?: number;
}

export type TicketStatus = 'open' | 'pending_tech_acceptance' | 'assigned' | 'awaiting_payment' | 'paid' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

export interface Ticket {
  id: string;
  clientId: string;
  techId?: string;
  status: TicketStatus;
  title: string;
  category: string;
  description: string;
  budgetType?: 'fixed' | 'hourly';
  budgetAmount?: number;
  platformFeePct: number;
  createdAt: number;
  updatedAt: number;
  imageUrl?: string;
  disputeReason?: string;
  rating?: {
    score: number;
    comment?: string;
    createdAt: number;
  };
}

export type PaymentStatus = 'pending' | 'proof_submitted' | 'confirmed' | 'rejected';

export interface Payment {
  id: string;
  ticketId: string;
  clientId: string;
  techId: string;
  method: 'pix';
  status: PaymentStatus;
  amountTotal: number;
  platformFee: number;
  techReceives: number;
  pixKey?: string;
  pixQRCode?: string;
  proofText?: string;
  proofImageUrl?: string;
  confirmedBy?: string;
  confirmedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  senderRole: UserRole;
  text: string;
  createdAt: number;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetRef: string;
  details?: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: number;
  link?: string;
}
