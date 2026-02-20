
export type UserRole = 'admin' | 'client' | 'tech';

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
  createdAt: number;
}

export type TicketStatus = 'open' | 'assigned' | 'awaiting_payment' | 'paid' | 'in_progress' | 'completed' | 'cancelled';

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
  proofText?: string;
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
