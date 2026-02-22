import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  Timestamp,
  increment,
  limit
} from "firebase/firestore";
import { db } from "./firebase";
import { User, Ticket, Payment, Message, AuditLog, AppNotification } from "../types";

export const database = {
  users: {
    getById: async (uid: string) => {
      if (!uid) return null;
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { ...docSnap.data(), uid } as User : null;
    },
    getAll: async () => {
      const querySnapshot = await getDocs(collection(db, "users"));
      return querySnapshot.docs.map(doc => doc.data() as User);
    },
    save: async (user: User) => {
      await setDoc(doc(db, "users", user.uid), user);
    },
    update: async (uid: string, updates: Partial<User>) => {
      await updateDoc(doc(db, "users", uid), updates);
    }
  },
  tickets: {
    getById: async (id: string) => {
      if (!id) return null;
      const docRef = doc(db, "tickets", id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as Ticket : null;
    },
    add: async (ticket: Ticket) => {
      await setDoc(doc(db, "tickets", ticket.id), ticket);
    },
    update: async (id: string, updates: Partial<Ticket>) => {
      await updateDoc(doc(db, "tickets", id), { ...updates, updatedAt: Date.now() });
    },
    delete: async (id: string) => {
      await deleteDoc(doc(db, "tickets", id));
    },
    listenAll: (callback: (tickets: Ticket[]) => void) => {
      return onSnapshot(query(collection(db, "tickets"), orderBy("createdAt", "desc")), (snapshot) => {
        callback(snapshot.docs.map(doc => doc.data() as Ticket));
      });
    }
  },
  payments: {
    getById: async (id: string) => {
      if (!id) return null;
      const docRef = doc(db, "payments", id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as Payment : null;
    },
    getByTicket: async (ticketId: string) => {
      if (!ticketId) return null;
      const q = query(collection(db, "payments"), where("ticketId", "==", ticketId));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty ? querySnapshot.docs[0].data() as Payment : null;
    },
    add: async (payment: Payment) => {
      await setDoc(doc(db, "payments", payment.id), payment);
    },
    update: async (id: string, updates: Partial<Payment>) => {
      await updateDoc(doc(db, "payments", id), { ...updates, updatedAt: Date.now() });
    },
    listenAll: (callback: (payments: Payment[]) => void) => {
      return onSnapshot(collection(db, "payments"), (snapshot) => {
        callback(snapshot.docs.map(doc => doc.data() as Payment));
      }, (error) => console.error("Payments listener error:", error));
    }
  },
  chats: {
    listenMessages: (ticketId: string, callback: (messages: Message[]) => void) => {
      if (!ticketId) return () => {};
      return onSnapshot(
        query(collection(db, "tickets", ticketId, "messages"), orderBy("createdAt", "asc")),
        (snapshot) => {
          callback(snapshot.docs.map(doc => doc.data() as Message));
        },
        (error) => console.error("Chat listener error:", error)
      );
    },
    addMessage: async (ticketId: string, message: Message) => {
      await setDoc(doc(db, "tickets", ticketId, "messages", message.id), message);
    }
  },
  logs: {
    add: async (log: AuditLog) => {
      await setDoc(doc(db, "logs", log.id), log);
    },
    listenAll: (callback: (logs: AuditLog[]) => void) => {
      return onSnapshot(query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(100)), (snapshot) => {
        callback(snapshot.docs.map(doc => doc.data() as AuditLog));
      }, (error) => console.error("Logs listener error:", error));
    }
  },
  notifications: {
    listen: (userId: string, callback: (notifications: AppNotification[]) => void) => {
      if (!userId) return () => {};
      // Removed orderBy to avoid composite index requirement, sorting in memory instead
      return onSnapshot(
        query(collection(db, "notifications"), where("userId", "==", userId)),
        (snapshot) => {
          const notifications = snapshot.docs.map(doc => doc.data() as AppNotification);
          notifications.sort((a, b) => b.createdAt - a.createdAt);
          callback(notifications);
        },
        (error) => console.error("Notifications listener error:", error)
      );
    },
    add: async (notification: AppNotification) => {
      await setDoc(doc(db, "notifications", notification.id), notification);
    },
    markAsRead: async (id: string) => {
      await updateDoc(doc(db, "notifications", id), { read: true });
    }
  }
};
