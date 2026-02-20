
import { User, Ticket, Payment, Message, AuditLog, UserRole } from '../types';

const STORAGE_KEYS = {
  USERS: 'rt_users',
  TICKETS: 'rt_tickets',
  PAYMENTS: 'rt_payments',
  CHATS: 'rt_chats',
  LOGS: 'rt_logs'
};

const get = <T,>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const save = <T,>(key: string, data: T[]): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const db = {
  users: {
    getAll: () => get<User>(STORAGE_KEYS.USERS),
    getById: (uid: string) => get<User>(STORAGE_KEYS.USERS).find(u => u.uid === uid),
    add: (user: User) => {
      const users = get<User>(STORAGE_KEYS.USERS);
      users.push(user);
      save(STORAGE_KEYS.USERS, users);
    }
  },
  tickets: {
    getAll: () => get<Ticket>(STORAGE_KEYS.TICKETS),
    getById: (id: string) => get<Ticket>(STORAGE_KEYS.TICKETS).find(t => t.id === id),
    getByClient: (clientId: string) => get<Ticket>(STORAGE_KEYS.TICKETS).filter(t => t.clientId === clientId),
    getByTech: (techId: string) => get<Ticket>(STORAGE_KEYS.TICKETS).filter(t => t.techId === techId),
    add: (ticket: Ticket) => {
      const tickets = get<Ticket>(STORAGE_KEYS.TICKETS);
      tickets.push(ticket);
      save(STORAGE_KEYS.TICKETS, tickets);
    },
    update: (id: string, updates: Partial<Ticket>) => {
      const tickets = get<Ticket>(STORAGE_KEYS.TICKETS);
      const index = tickets.findIndex(t => t.id === id);
      if (index !== -1) {
        tickets[index] = { ...tickets[index], ...updates, updatedAt: Date.now() };
        save(STORAGE_KEYS.TICKETS, tickets);
      }
    }
  },
  payments: {
    getAll: () => get<Payment>(STORAGE_KEYS.PAYMENTS),
    getById: (id: string) => get<Payment>(STORAGE_KEYS.PAYMENTS).find(p => p.id === id),
    getByTicket: (ticketId: string) => get<Payment>(STORAGE_KEYS.PAYMENTS).find(p => p.ticketId === ticketId),
    getByStatus: (status: string) => get<Payment>(STORAGE_KEYS.PAYMENTS).filter(p => p.status === status),
    add: (payment: Payment) => {
      const payments = get<Payment>(STORAGE_KEYS.PAYMENTS);
      payments.push(payment);
      save(STORAGE_KEYS.PAYMENTS, payments);
    },
    update: (id: string, updates: Partial<Payment>) => {
      const payments = get<Payment>(STORAGE_KEYS.PAYMENTS);
      const index = payments.findIndex(p => p.id === id);
      if (index !== -1) {
        payments[index] = { ...payments[index], ...updates, updatedAt: Date.now() };
        save(STORAGE_KEYS.PAYMENTS, payments);
      }
    }
  },
  chats: {
    getMessages: (ticketId: string) => {
      const allChats = get<{ ticketId: string, messages: Message[] }>(STORAGE_KEYS.CHATS);
      const chat = allChats.find(c => c.ticketId === ticketId);
      return chat ? chat.messages : [];
    },
    addMessage: (ticketId: string, message: Message) => {
      const allChats = get<{ ticketId: string, messages: Message[] }>(STORAGE_KEYS.CHATS);
      const chatIndex = allChats.findIndex(c => c.ticketId === ticketId);
      if (chatIndex !== -1) {
        allChats[chatIndex].messages.push(message);
      } else {
        allChats.push({ ticketId, messages: [message] });
      }
      save(STORAGE_KEYS.CHATS, allChats);
    }
  },
  logs: {
    add: (log: AuditLog) => {
      const logs = get<AuditLog>(STORAGE_KEYS.LOGS);
      logs.push(log);
      save(STORAGE_KEYS.LOGS, logs);
    },
    getAll: () => get<AuditLog>(STORAGE_KEYS.LOGS).sort((a, b) => b.createdAt - a.createdAt)
  }
};

// Seeder: Create Admin if empty
if (db.users.getAll().length === 0) {
  db.users.add({
    uid: 'admin-01',
    email: 'admin@remototech.com',
    role: 'admin',
    status: 'active',
    createdAt: Date.now()
  });
}
