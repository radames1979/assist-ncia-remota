
import React, { useState, useEffect } from 'react';
import { User, Ticket, Payment, Message, UserRole, TicketStatus, PaymentStatus, AppNotification, AuditLog } from './types';
import { auth } from './services/firebase';
import { database } from './services/database';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { PLATFORM_FEE_PCT, TICKET_STATUS_LABELS, CATEGORIES, PAYMENT_STATUS_LABELS } from './constants';
import { analyzeMessageSafety, summarizeAuditLog, suggestCategory } from './services/gemini';

// --- UI Components ---

const NotificationBell = ({ count, onClick }: { count: number, onClick: () => void }) => (
  <button onClick={onClick} className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
    {count > 0 && (
      <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
        {count}
      </span>
    )}
  </button>
);

const StarRating = ({ rating, onRate, readonly = false }: { rating: number, onRate?: (r: number) => void, readonly?: boolean }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(star => (
      <button
        key={star}
        disabled={readonly}
        onClick={() => onRate?.(star)}
        className={`${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} transition-colors`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
    ))}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: any) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50"
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, loading }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-2xl">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

// Fix: Changed children type to React.ReactNode to resolve JSX tag's 'children' prop expectation errors when using expressions.
const Badge = ({ children, status }: { children: React.ReactNode, status: string }) => {
  const colors: any = {
    open: "bg-blue-100 text-blue-800",
    assigned: "bg-indigo-100 text-indigo-800",
    awaiting_payment: "bg-amber-100 text-amber-800",
    paid: "bg-green-100 text-green-800",
    in_progress: "bg-purple-100 text-purple-800",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-slate-100 text-slate-800",
    confirmed: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    proof_submitted: "bg-blue-100 text-blue-800",
    pending: "bg-slate-100 text-slate-800"
  };
  return <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${colors[status] || "bg-gray-100"}`}>{children}</span>;
};

const TechTicketCard = ({ ticket, onClick, actionButton }: { ticket: Ticket, onClick: () => void, actionButton?: React.ReactNode, key?: any }) => {
  const [client, setClient] = useState<User | null>(null);
  const [tech, setTech] = useState<User | null>(null);

  useEffect(() => {
    database.users.getById(ticket.clientId).then(setClient);
    if (ticket.techId) {
      database.users.getById(ticket.techId).then(setTech);
    }
  }, [ticket.clientId, ticket.techId]);

  return (
    <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-full" onClick={onClick}>
      <div>
        <div className="flex justify-between items-start mb-3">
          <Badge status={ticket.status}>{TICKET_STATUS_LABELS[ticket.status] || ticket.status}</Badge>
          <span className="text-[10px] font-mono text-slate-400">#{ticket.id?.substring(0, 6) || '---'}</span>
        </div>
        
        <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors mb-2 line-clamp-1">{ticket.title}</h3>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Cliente"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="truncate">Cliente: {client?.email || 'Carregando...'}</span>
          </div>
          {ticket.techId && (
            <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Técnico"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              <span className="truncate">Técnico: {tech?.email || 'Carregando...'}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
            <span>{ticket.category}</span>
          </div>
        </div>

        <p className="text-sm text-slate-600 line-clamp-2 mb-4 bg-slate-50 p-2 rounded border border-slate-100 italic">
          {ticket.description}
        </p>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
        <div className="flex flex-col">
          {ticket.budgetAmount ? (
            <span className="text-sm font-bold text-green-600">R$ {ticket.budgetAmount.toFixed(2)}</span>
          ) : (
            <span className="text-[10px] text-slate-400 italic">Aguardando orçamento</span>
          )}
        </div>
        {actionButton && <div onClick={(e) => e.stopPropagation()}>{actionButton}</div>}
      </div>
    </Card>
  );
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const ITEMS_PER_PAGE = 6;

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }: any) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const showMax = 3; // Number of page buttons to show around current page

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex justify-center items-center gap-1 mt-8">
      <Button 
        variant="outline" 
        className="px-2 py-1 h-8 sm:h-10 w-8 sm:w-10 flex items-center justify-center" 
        disabled={currentPage === 1} 
        onClick={() => onPageChange(currentPage - 1)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </Button>

      <div className="flex items-center gap-1">
        {getPageNumbers().map((page, idx) => (
          <React.Fragment key={`${page}-${idx}`}>
            {page === '...' ? (
              <span className="px-1 sm:px-2 text-slate-400 text-xs sm:text-sm">...</span>
            ) : (
              <button
                onClick={() => onPageChange(page)}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  currentPage === page
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                }`}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}
      </div>

      <Button 
        variant="outline" 
        className="px-2 py-1 h-8 sm:h-10 w-8 sm:w-10 flex items-center justify-center" 
        disabled={currentPage === totalPages} 
        onClick={() => onPageChange(currentPage + 1)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </Button>
    </div>
  );
};

const SupportModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Suporte RemotoTech
        </h3>
        <p className="text-slate-600 mb-6 text-sm">
          Está com problemas técnicos na plataforma ou dúvidas sobre pagamentos? Nossa equipe está pronta para ajudar.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="p-2 bg-blue-100 rounded text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div>
              <p className="font-bold text-sm">E-mail de Suporte</p>
              <p className="text-sm text-slate-500">suporte@remototech.com</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="p-2 bg-emerald-100 rounded text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <div>
              <p className="font-bold text-sm">WhatsApp Financeiro</p>
              <p className="text-sm text-slate-500">(11) 99999-9999</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="p-2 bg-amber-100 rounded text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <p className="font-bold text-sm">Horário de Atendimento</p>
              <p className="text-sm text-slate-500">Segunda a Sexta, das 09h às 18h</p>
            </div>
          </div>
        </div>
        
        <Button className="w-full mt-6" onClick={onClose}>Entendi</Button>
      </Card>
    </div>
  );
};

const InstitutionalModal = ({ isOpen, page, onClose }: { isOpen: boolean, page: 'terms' | 'privacy' | 'faq' | null, onClose: () => void }) => {
  if (!isOpen || !page) return null;

  const content = {
    terms: {
      title: "Termos de Uso",
      body: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>Bem-vindo ao RemotoTech. Ao utilizar nossa plataforma, você concorda com os seguintes termos:</p>
          <h4 className="font-bold text-slate-800">1. Objeto</h4>
          <p>O RemotoTech é uma plataforma de intermediação entre clientes que buscam assistência técnica e profissionais qualificados.</p>
          <h4 className="font-bold text-slate-800">2. Pagamentos</h4>
          <p>Todos os pagamentos devem ser realizados através da plataforma para garantir a segurança de ambas as partes. O descumprimento desta regra pode levar à suspensão da conta.</p>
          <h4 className="font-bold text-slate-800">3. Responsabilidades</h4>
          <p>O técnico é responsável pela qualidade do serviço prestado. O RemotoTech atua como mediador em caso de disputas.</p>
        </div>
      )
    },
    privacy: {
      title: "Política de Privacidade",
      body: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>Sua privacidade é importante para nós. Veja como tratamos seus dados:</p>
          <h4 className="font-bold text-slate-800">1. Coleta de Dados</h4>
          <p>Coletamos seu e-mail, nome e telefone para possibilitar a comunicação e prestação dos serviços.</p>
          <h4 className="font-bold text-slate-800">2. Uso das Informações</h4>
          <p>Seus dados são utilizados exclusivamente para o funcionamento da plataforma e notificações sobre seus chamados.</p>
          <h4 className="font-bold text-slate-800">3. Segurança</h4>
          <p>Utilizamos tecnologias de ponta para garantir que seus dados e históricos de chat estejam protegidos.</p>
        </div>
      )
    },
    faq: {
      title: "Perguntas Frequentes (FAQ)",
      body: (
        <div className="space-y-6 text-sm text-slate-600">
          <div>
            <h4 className="font-bold text-slate-800 mb-1">Como funciona o pagamento?</h4>
            <p>O cliente realiza o PIX para os dados informados pelo técnico. O administrador confirma o recebimento e libera o início do serviço.</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-1">O que acontece se o serviço não for concluído?</h4>
            <p>O cliente pode abrir uma disputa. O administrador analisará o caso e poderá reembolsar o valor ou liberar para o técnico.</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-1">Posso falar com o técnico por fora?</h4>
            <p>Não recomendamos. Conversas fora do chat da plataforma não podem ser usadas como prova em caso de disputa.</p>
          </div>
        </div>
      )
    }
  };

  const active = content[page];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-2 border-b">
          <h2 className="text-2xl font-bold text-slate-800">{active.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="pb-4">
          {active.body}
        </div>
        <div className="mt-6 pt-4 border-t flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </Card>
    </div>
  );
};

// --- App Pages ---

const TicketDetailView = ({ 
  ticket, 
  currentUser, 
  onBack, 
  onSendMessage, 
  onSetBudget, 
  onSubmitProof, 
  onConfirmPayment, 
  onRejectPayment, 
  onStartExecution, 
  onDispute, 
  onResolveDispute,
  onFinish, 
  onRate,
  onDelete,
  onUpdate,
  onPayWithStripe,
  isProcessingPayment,
  payment
}: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [client, setClient] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ticket.title);
  const [editDescription, setEditDescription] = useState(ticket.description);
  const [pixQRCode, setPixQRCode] = useState<string>('');
  const [isUploadingQR, setIsUploadingQR] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = database.chats.listenMessages(ticket.id, setMessages);
    database.users.getById(ticket.clientId).then(setClient);
    return () => unsub();
  }, [ticket.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const canDelete = currentUser.role === 'admin' || (currentUser.role === 'client' && ticket.clientId === currentUser.uid && ticket.status === 'open');
  const canEdit = currentUser.role === 'admin' || (currentUser.role === 'client' && ticket.clientId === currentUser.uid && (ticket.status === 'open' || ticket.status === 'assigned'));

  const handleSave = async () => {
    await onUpdate(ticket.id, { title: editTitle, description: editDescription });
    setIsEditing(false);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack}>← Voltar</Button>
              {canEdit && !isEditing && (
                <Button variant="secondary" className="px-3" onClick={() => setIsEditing(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </Button>
              )}
              {canDelete && (
                <Button variant="danger" className="px-3" onClick={() => onDelete(ticket.id)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </Button>
              )}
            </div>
            <Badge status={ticket.status}>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
          </div>
          
          {isEditing ? (
            <div className="space-y-4">
              <input 
                className="text-3xl font-extrabold w-full p-2 border rounded-lg"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <textarea 
                className="text-slate-600 bg-slate-50 p-4 rounded-lg whitespace-pre-wrap w-full h-32 border"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handleSave}>Salvar Alterações</Button>
                <Button variant="outline" onClick={() => {
                  setIsEditing(false);
                  setEditTitle(ticket.title);
                  setEditDescription(ticket.description);
                }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold mb-2">{ticket.title}</h1>
              <p className="text-slate-600 bg-slate-50 p-4 rounded-lg whitespace-pre-wrap mb-4">{ticket.description}</p>
            </>
          )}
          {ticket.imageUrl && (
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Anexo do Problema:</p>
              <img src={ticket.imageUrl} alt="Problema" className="max-w-full h-auto rounded-lg border shadow-sm max-h-64 object-contain" />
            </div>
          )}
        </Card>

        <Card className="flex flex-col h-[500px] border-slate-200 shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
              Chat de Atendimento
            </h3>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold animate-pulse">LIVE</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scroll-smooth">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${
                  m.senderId === currentUser.uid 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                }`}>
                  <div className="flex justify-between items-center gap-4 mb-1">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${m.senderId === currentUser.uid ? 'text-blue-100' : 'text-slate-500'}`}>
                      {m.senderRole === 'tech' ? '🛠️ Técnico' : m.senderRole === 'client' ? '👤 Cliente' : '🛡️ Admin'}
                    </p>
                    <p className={`text-[9px] opacity-70 ${m.senderId === currentUser.uid ? 'text-blue-100' : 'text-slate-400'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
                <p className="text-sm italic">Inicie a conversa para alinhar o atendimento.</p>
              </div>
            )}
          </div>
          <form onSubmit={(e: any) => {
            e.preventDefault();
            const msg = e.target.msg.value.trim();
            if (msg) {
              onSendMessage(ticket.id, msg);
              e.target.reset();
            }
          }} className="flex gap-2 border-t pt-4">
            <input 
              name="msg" 
              autoComplete="off"
              placeholder="Digite sua mensagem..." 
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm" 
              required 
            />
            <Button type="submit" className="rounded-xl px-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </Button>
          </form>
        </Card>
      </div>

      <div className="space-y-6">
        {(currentUser.role === 'admin' || currentUser.role === 'tech') && client && (
          <Card className="border-blue-100 bg-blue-50/30">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              👤 Informações do Cliente
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-medium">{client.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Membro desde:</span>
                <span className="font-medium">{new Date(client.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ID do Usuário:</span>
                <span className="font-mono text-[10px]">{client.uid}</span>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <h3 className="font-bold text-lg mb-4">Informações de Pagamento</h3>
          {!payment && currentUser.role === 'tech' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 italic">Defina o orçamento e os dados de pagamento PIX para o cliente.</p>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Valor Total (R$):</label>
                <input type="number" id="budgetInput" placeholder="Ex: 150.00" className="w-full p-2 border rounded mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Chave PIX / ID Transação:</label>
                <input type="text" id="pixKeyInput" placeholder="Sua chave PIX" className="w-full p-2 border rounded mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">QR Code PIX (Opcional):</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="w-full text-xs mt-1" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIsUploadingQR(true);
                      const base64 = await fileToBase64(file);
                      setPixQRCode(base64);
                      setIsUploadingQR(false);
                    }
                  }}
                />
                {pixQRCode && <img src={pixQRCode} alt="Preview QR" className="mt-2 h-20 w-20 object-contain border rounded" />}
              </div>
              <Button className="w-full" disabled={isUploadingQR} onClick={() => {
                const val = parseFloat((document.getElementById('budgetInput') as HTMLInputElement).value);
                const key = (document.getElementById('pixKeyInput') as HTMLInputElement).value;
                if (val > 0) onSetBudget(ticket.id, val, key, pixQRCode);
              }}>
                {isUploadingQR ? 'Processando QR...' : 'Enviar Orçamento'}
              </Button>
            </div>
          )}

          {!payment && currentUser.role === 'client' && (
            <p className="text-slate-500 italic">Aguardando orçamento do técnico.</p>
          )}

          {payment && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Valor Total:</span>
                <span className="font-bold">R$ {payment.amountTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Status:</span>
                <Badge status={payment.status}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
              </div>

              {currentUser.role === 'client' && payment.status === 'pending' && (
                <div className="pt-4 border-t space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wider">Dados para Pagamento PIX:</p>
                    
                    {payment.pixQRCode && (
                      <div className="flex justify-center mb-4 bg-white p-2 rounded border">
                        <img src={payment.pixQRCode} alt="QR Code PIX" className="max-w-[150px] h-auto" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">Chave PIX / ID:</p>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded border text-sm flex-1 break-all">{payment.pixKey || 'Não informada'}</code>
                        {payment.pixKey && (
                          <button 
                            onClick={() => navigator.clipboard.writeText(payment.pixKey!)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            title="Copiar Chave"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Confirmar Pagamento:</p>
                    <p className="text-[10px] text-slate-400">Após realizar o PIX, anexe o comprovante abaixo para validação.</p>
                    <textarea id="proofInput" placeholder="Cole o texto do comprovante aqui..." className="w-full p-2 border rounded h-20 text-sm" />
                    <div>
                      <label className="text-xs font-bold opacity-80 block mb-1">Print do Comprovante:</label>
                      <input type="file" id="proofImageInput" accept="image/*" className="text-xs w-full" />
                    </div>
                    <Button className="w-full" onClick={async () => {
                      const proof = (document.getElementById('proofInput') as HTMLTextAreaElement).value;
                      const imageFile = (document.getElementById('proofImageInput') as HTMLInputElement).files?.[0];
                      if (proof || imageFile) await onSubmitProof(payment.id, proof, imageFile);
                    }}>Enviar Comprovante</Button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Ou pague agora</span></div>
                  </div>

                  <Button 
                    variant="primary" 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2"
                    onClick={() => onPayWithStripe(ticket, payment)}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? 'Processando...' : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        Pagar com Stripe (Cartão/PIX)
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-center text-slate-400">Verificação automática e liberação imediata.</p>
                </div>
              )}

              {currentUser.role === 'client' && payment.status === 'proof_submitted' && (
                <p className="bg-amber-50 text-amber-800 p-3 rounded text-sm italic">Comprovante enviado! Aguarde o Admin confirmar para liberar o técnico.</p>
              )}

              {currentUser.role === 'tech' && payment.status === 'confirmed' && (
                <div className="bg-green-100 text-green-800 p-3 rounded">
                  <p className="text-sm font-bold">Pagamento Confirmado!</p>
                  <p className="text-xs">Você receberá R$ {payment.techReceives.toFixed(2)} após a conclusão.</p>
                  <Button className="w-full mt-2" onClick={() => onStartExecution(ticket.id)}>Iniciar Execução</Button>
                </div>
              )}
            </div>
          )}
        </Card>

        {ticket.status === 'disputed' && currentUser.role === 'admin' && (
          <Card className="border-red-500 bg-red-50 shadow-lg ring-2 ring-red-200">
            <h3 className="font-bold text-red-700 mb-2 flex items-center gap-2">
              ⚖️ Central de Mediação (Admin)
            </h3>
            <p className="text-sm text-red-800 mb-4 bg-white/50 p-3 rounded border border-red-100 italic">
              <strong>Motivo da Disputa:</strong> {ticket.disputeReason}
            </p>
            <div className="space-y-3">
              <p className="text-xs text-slate-600">Como administrador, analise o chat e as evidências acima para tomar uma decisão final.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="danger" 
                  className="text-xs py-3"
                  onClick={() => {
                    if (confirm("Confirmar reembolso ao cliente? O ticket será cancelado.")) {
                      onResolveDispute(ticket.id, 'client');
                    }
                  }}
                >
                  Reembolsar Cliente
                </Button>
                <Button 
                  variant="primary" 
                  className="text-xs py-3 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    if (confirm("Confirmar liberação ao técnico? O ticket será concluído.")) {
                      onResolveDispute(ticket.id, 'tech');
                    }
                  }}
                >
                  Liberar para Técnico
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="bg-slate-900 text-white">
          <h3 className="font-bold mb-2">🛡️ Regras de Segurança</h3>
          <ul className="text-xs space-y-2 opacity-80">
            <li>• Jamais compartilhe WhatsApp ou redes sociais no chat.</li>
            <li>• O pagamento deve ser feito exclusivamente via plataforma.</li>
            <li>• O descumprimento gera suspensão imediata da conta.</li>
          </ul>
        </Card>

        {ticket.status === 'in_progress' && currentUser.role === 'client' && (
          <Card className="border-red-200">
            <h3 className="font-bold text-red-600 mb-2">Problemas com o serviço?</h3>
            <p className="text-xs text-slate-500 mb-4">Se o técnico não estiver cumprindo o combinado, você pode abrir uma disputa.</p>
            <Button variant="danger" className="w-full text-sm" onClick={() => {
              const reason = prompt("Descreva o motivo da disputa:");
              if (reason) onDispute(ticket.id, reason);
            }}>Abrir Disputa</Button>
          </Card>
        )}

        {ticket.status === 'in_progress' && currentUser.role === 'tech' && (
          <Button className="w-full" onClick={() => onFinish(ticket.id)}>Finalizar Atendimento</Button>
        )}

        {ticket.status === 'completed' && currentUser.role === 'client' && !ticket.rating && (
          <Card className="bg-amber-50 border-amber-200">
            <h3 className="font-bold text-amber-800 mb-2">Avalie o Técnico</h3>
            <p className="text-xs text-amber-700 mb-4">Sua avaliação ajuda a manter a qualidade da plataforma.</p>
            <div className="space-y-4">
              <StarRating rating={0} onRate={(r) => {
                const comment = prompt("Deixe um comentário (opcional):");
                onRate(ticket.id, r, comment || '');
              }} />
            </div>
          </Card>
        )}

        {ticket.rating && (
          <Card className="bg-slate-50">
            <h3 className="font-bold mb-2">Avaliação do Cliente</h3>
            <StarRating rating={ticket.rating.score} readonly />
            {ticket.rating.comment && <p className="text-sm italic mt-2 text-slate-600">"{ticket.rating.comment}"</p>}
          </Card>
        )}
      </div>
    </div>
  );
};

const LandingPage = ({ onStart }: { onStart: () => void }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6 text-center">
    <div className="max-w-3xl">
      <h1 className="text-5xl font-extrabold text-slate-900 mb-6">Assistência Técnica <span className="text-blue-600">Remota</span></h1>
      <p className="text-xl text-slate-600 mb-8">Conectando problemas de hardware e software com técnicos especialistas, sem precisar sair de casa.</p>
      <div className="flex gap-4 justify-center">
        <Button onClick={onStart} className="text-lg px-8 py-4">Entrar na Plataforma</Button>
      </div>
      <p className="mt-8 text-[10px] text-slate-400 uppercase tracking-widest">Plataforma v1.5.2 - Stripe & Financeiro Ativo</p>
    </div>
  </div>
);

const AuthPage = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState<UserRole>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const finalRole = email === 'messi@bol.com.br' ? 'admin' : role;
        const newUser: User = { 
          uid: userCredential.user.uid, 
          email, 
          role: finalRole, 
          status: 'active', 
          createdAt: Date.now() 
        };
        await database.users.save(newUser);
        const cleanRole = newUser.role.toLowerCase().replace(/['"]+/g, '').trim() as UserRole;
        const normalizedUser = { ...newUser, role: cleanRole };
        onLogin(normalizedUser);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        let user = await database.users.getById(userCredential.user.uid);
        
        // Fallback: If user exists in Auth but not in Firestore (e.g. pre-existing users)
        if (!user) {
          let detectedRole: UserRole = 'client';
          if (email === 'messi@bol.com.br') detectedRole = 'admin';
          else if (email === 'tecnico@teste.com') detectedRole = 'tech';
          
          user = {
            uid: userCredential.user.uid,
            email,
            role: detectedRole,
            status: 'active',
            createdAt: Date.now()
          };
          await database.users.save(user);
        }
        
        const cleanRole = user.role.toLowerCase().replace(/['"]+/g, '').trim() as UserRole;
        const normalizedUser = { ...user, role: cleanRole };
        onLogin(normalizedUser);
      }
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">{isRegister ? 'Criar Conta' : 'Login'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input 
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1">Eu sou um:</label>
              <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full p-2 border rounded-lg">
                <option value="client">Cliente (Preciso de Ajuda)</option>
                <option value="tech">Técnico (Quero Atender)</option>
              </select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Processando...' : (isRegister ? 'Cadastrar' : 'Entrar')}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          {isRegister ? 'Já tem conta?' : 'Novo aqui?'} 
          <button className="text-blue-600 ml-1 font-semibold" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Fazer Login' : 'Criar Conta'}
          </button>
        </p>
      </Card>
    </div>
  );
};

// --- Main App Logic ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'auth' | 'dashboard' | 'ticket' | 'admin_logs' | 'profile'>('landing');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [institutionalPage, setInstitutionalPage] = useState<'terms' | 'privacy' | 'faq' | null>(null);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, ticketId: string | null }>({ isOpen: false, ticketId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [techFilter, setTechFilter] = useState<string>('all');
  const [techCategoryFilter, setTechCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminPage, setAdminPage] = useState(1);
  const [techAssignedPage, setTechAssignedPage] = useState(1);
  const [techAvailablePage, setTechAvailablePage] = useState(1);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await database.users.getById(firebaseUser.uid);
        if (user) {
          const cleanRole = (user.role || 'client').toLowerCase().replace(/['"]+/g, '').trim() as UserRole;
          const normalizedUser = { ...user, role: cleanRole };
          setCurrentUser(normalizedUser);
          setProfileName(user.name || '');
          setProfilePhone(user.phone || '');
          setView('dashboard');
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle Stripe Return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('payment_success');
    const sessionId = params.get('session_id');
    const ticketId = params.get('ticket_id');

    if (paymentSuccess === 'true' && sessionId && ticketId && payments.length > 0) {
      const verify = async () => {
        try {
          const res = await fetch(`/api/verify-payment/${sessionId}`);
          const data = await res.json();
          if (data.status === 'paid') {
            const payment = payments.find(p => p.ticketId === ticketId);
            if (payment && payment.status !== 'confirmed') {
              await confirmPayment(payment.id);
              alert("Pagamento confirmado automaticamente via Stripe!");
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        } catch (error) {
          console.error("Verification failed", error);
        }
      };
      verify();
    }
  }, [payments]);

  useEffect(() => {
    setTechAssignedPage(1);
    setTechAvailablePage(1);
  }, [techFilter, techCategoryFilter]);

  // Real-time Listeners
  useEffect(() => {
    if (!currentUser) return;

    const unsubTickets = database.tickets.listenAll(setTickets);
    const unsubPayments = database.payments.listenAll(setPayments);
    const unsubNotifications = database.notifications.listen(currentUser.uid, setNotifications);
    
    let unsubLogs: () => void = () => {};
    if (currentUser.role === 'admin') {
      unsubLogs = database.logs.listenAll(setLogs);
    }

    return () => {
      unsubTickets();
      unsubPayments();
      unsubNotifications();
      unsubLogs();
    };
  }, [currentUser]);

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setView('landing');
  };

  const createTicket = async (title: string, description: string, manualCategory: string, imageFile?: File) => {
    if (!currentUser) return;
    setIsCategorizing(true);
    
    let imageUrl = '';
    if (imageFile) {
      imageUrl = await fileToBase64(imageFile);
    }

    // Gemini Auto-categorization
    const category = manualCategory === "Outros" ? await suggestCategory(description) : manualCategory;
    
    const newTicket: Ticket = {
      id: `t-${Date.now()}`,
      clientId: currentUser.uid,
      status: 'open',
      title,
      category,
      description,
      platformFeePct: PLATFORM_FEE_PCT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      imageUrl
    };
    await database.tickets.add(newTicket);
    await database.logs.add({ id: `l-${Date.now()}`, actorId: currentUser.uid, action: 'CREATE_TICKET', targetRef: newTicket.id, createdAt: Date.now() });
    
    // Notify Admins
    const allUsers = await database.users.getAll();
    allUsers.filter(u => u.role === 'admin').forEach(async (admin) => {
      await database.notifications.add({
        id: `n-${Date.now()}-${admin.uid}`,
        userId: admin.uid,
        title: "Novo Ticket Criado",
        message: `Um novo ticket "${title}" foi criado e aguarda atribuição.`,
        type: 'info',
        read: false,
        createdAt: Date.now(),
        link: newTicket.id
      });
    });

    setIsCategorizing(false);
  };

  const disputeTicket = async (ticketId: string, reason: string) => {
    await database.tickets.update(ticketId, { status: 'disputed', disputeReason: reason });
    await database.logs.add({ id: `l-${Date.now()}`, actorId: currentUser?.uid || '', action: 'DISPUTE_TICKET', targetRef: ticketId, details: reason, createdAt: Date.now() });
    
    // Notify Admin
    const allUsers = await database.users.getAll();
    allUsers.filter(u => u.role === 'admin').forEach(async (admin) => {
      await database.notifications.add({
        id: `n-${Date.now()}-${admin.uid}`,
        userId: admin.uid,
        title: "Ticket em Disputa",
        message: `O ticket ${ticketId} foi colocado em disputa pelo cliente.`,
        type: 'warning',
        read: false,
        createdAt: Date.now(),
        link: ticketId
      });
    });
  };

  const rateTechnician = async (ticketId: string, score: number, comment: string) => {
    const ticket = await database.tickets.getById(ticketId);
    if (!ticket || !ticket.techId) return;

    await database.tickets.update(ticketId, { 
      status: 'completed',
      rating: { score, comment, createdAt: Date.now() }
    });

    // Update Tech Rating
    const tech = await database.users.getById(ticket.techId);
    if (tech) {
      const totalRatings = (tech.totalRatings || 0) + 1;
      const currentRating = tech.rating || 0;
      const newRating = ((currentRating * (tech.totalRatings || 0)) + score) / totalRatings;
      await database.users.update(tech.uid, { rating: newRating, totalRatings });
    }

    await database.logs.add({ id: `l-${Date.now()}`, actorId: currentUser?.uid || '', action: 'RATE_TECH', targetRef: ticket.techId, details: `Score: ${score}`, createdAt: Date.now() });
  };

  const assignTech = async (ticketId: string, techId: string) => {
    await database.tickets.update(ticketId, { techId, status: 'assigned' });
    await database.logs.add({ id: `l-${Date.now()}`, actorId: currentUser?.uid || '', action: 'ASSIGN_TECH', targetRef: ticketId, details: `Tech: ${techId}`, createdAt: Date.now() });
  };

  const acceptTicket = async (ticketId: string) => {
    if (!currentUser || currentUser.role !== 'tech') return;
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    await database.tickets.update(ticketId, { techId: currentUser.uid, status: 'assigned' });
    await database.logs.add({ id: `l-${Date.now()}`, actorId: currentUser.uid, action: 'ACCEPT_TICKET', targetRef: ticketId, createdAt: Date.now() });

    // Notify Client
    await database.notifications.add({
      id: `n-${Date.now()}-${ticket.clientId}`,
      userId: ticket.clientId,
      title: "Técnico Atribuído",
      message: `O técnico ${currentUser.email} aceitou seu chamado "${ticket.title}".`,
      type: 'info',
      read: false,
      createdAt: Date.now(),
      link: ticket.id
    });
  };

  const setBudget = async (ticketId: string, amount: number, pixKey?: string, pixQRCode?: string) => {
    const ticket = await database.tickets.getById(ticketId);
    if (!ticket || !ticket.techId) return;

    const fee = amount * (ticket.platformFeePct / 100);
    const techGets = amount - fee;

    const newPayment: Payment = {
      id: `p-${Date.now()}`,
      ticketId,
      clientId: ticket.clientId,
      techId: ticket.techId,
      method: 'pix',
      status: 'pending',
      amountTotal: amount,
      platformFee: fee,
      techReceives: techGets,
      pixKey,
      pixQRCode,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.payments.add(newPayment);
    await database.tickets.update(ticketId, { budgetAmount: amount, budgetType: 'fixed', status: 'awaiting_payment' });
  };

  const submitPaymentProof = async (paymentId: string, proofText: string, imageFile?: File) => {
    let proofImageUrl = '';
    if (imageFile) {
      proofImageUrl = await fileToBase64(imageFile);
    }
    await database.payments.update(paymentId, { proofText, proofImageUrl, status: 'proof_submitted' });
  };

  const confirmPayment = async (paymentId: string) => {
    const payment = await database.payments.getById(paymentId);
    if (!payment) return;
    await database.payments.update(paymentId, { status: 'confirmed', confirmedBy: currentUser?.uid, confirmedAt: Date.now() });
    await database.tickets.update(payment.ticketId, { status: 'paid' });
    await database.logs.add({ id: `l-${Date.now()}`, actorId: currentUser?.uid || '', action: 'CONFIRM_PAYMENT', targetRef: paymentId, createdAt: Date.now() });
  };

  const rejectPayment = async (paymentId: string) => {
    await database.payments.update(paymentId, { status: 'rejected' });
  };

  const sendMessage = async (ticketId: string, text: string) => {
    if (!currentUser) return;
    
    // Smart Moderation with Gemini
    const safety = await analyzeMessageSafety(text);
    if (!safety.isSafe) {
      alert(`Mensagem bloqueada: ${safety.reason}`);
      return;
    }

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      senderId: currentUser.uid,
      senderRole: currentUser.role,
      text,
      createdAt: Date.now()
    };
    await database.chats.addMessage(ticketId, newMessage);

    // Notify the other party
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      const recipientId = currentUser.role === 'client' ? ticket.techId : ticket.clientId;
      if (recipientId) {
        await database.notifications.add({
          id: `n-chat-${Date.now()}`,
          userId: recipientId,
          title: "Nova Mensagem",
          message: `Você recebeu uma nova mensagem no chamado "${ticket.title}".`,
          type: 'info',
          read: false,
          createdAt: Date.now(),
          link: ticket.id
        });
      }
    }
  };

  const handleDeleteTicket = async () => {
    if (!deleteModal.ticketId) return;
    setIsDeleting(true);
    try {
      await database.tickets.delete(deleteModal.ticketId);
      await database.logs.add({ 
        id: `l-${Date.now()}`, 
        actorId: currentUser?.uid || '', 
        action: 'DELETE_TICKET', 
        targetRef: deleteModal.ticketId, 
        createdAt: Date.now() 
      });
      setDeleteModal({ isOpen: false, ticketId: null });
      setView('dashboard');
    } catch (error: any) {
      alert(`Erro ao excluir ticket: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      await database.users.update(currentUser.uid, { name: profileName, phone: profilePhone });
      setCurrentUser({ ...currentUser, name: profileName, phone: profilePhone });
      alert("Perfil atualizado com sucesso!");
    } catch (error: any) {
      alert(`Erro ao salvar perfil: ${error.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const resolveDispute = async (ticketId: string, resolution: 'client' | 'tech') => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const ticket = tickets.find(t => t.id === ticketId);
    const payment = payments.find(p => p.ticketId === ticketId);
    if (!ticket) return;

    if (resolution === 'client') {
      await database.tickets.update(ticketId, { status: 'cancelled' });
      if (payment) {
        await database.payments.update(payment.id, { status: 'rejected' });
      }
    } else {
      await database.tickets.update(ticketId, { status: 'completed' });
      if (payment) {
        await database.payments.update(payment.id, { status: 'confirmed' });
      }
    }

    await database.logs.add({
      id: `l-${Date.now()}`,
      actorId: currentUser.uid,
      action: 'RESOLVE_DISPUTE',
      targetRef: ticketId,
      details: `Resolved in favor of ${resolution}`,
      createdAt: Date.now()
    });

    const notify = async (uid: string, msg: string) => {
      await database.notifications.add({
        id: `n-${Date.now()}-${uid}`,
        userId: uid,
        title: "Disputa Resolvida",
        message: msg,
        type: 'info',
        read: false,
        createdAt: Date.now(),
        link: ticketId
      });
    };

    await notify(ticket.clientId, `A disputa do chamado "${ticket.title}" foi resolvida pelo administrador em favor do ${resolution === 'client' ? 'cliente' : 'técnico'}.`);
    if (ticket.techId) {
      await notify(ticket.techId, `A disputa do chamado "${ticket.title}" foi resolvida pelo administrador em favor do ${resolution === 'client' ? 'cliente' : 'técnico'}.`);
    }
    alert("Disputa resolvida com sucesso!");
  };

  const handlePayWithStripe = async (ticket: Ticket, payment: Payment) => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          amount: payment.amountTotal,
          ticketTitle: ticket.title,
        }),
      });
      const { url, error } = await response.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (error: any) {
      alert(`Erro ao iniciar pagamento: ${error.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // --- Views ---

  const renderDashboard = () => {
    if (!currentUser) return null;

    const role = (currentUser.role || '').toLowerCase().replace(/['"]+/g, '').trim();
    console.log("Rendering Dashboard for role:", role);

    if (role === 'admin') {
      const pendingPayments = payments.filter(p => p.status === 'proof_submitted');
      const disputedTickets = tickets.filter(t => t.status === 'disputed');
      const filteredTickets = tickets.filter(t => 
        (t.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
        (t.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (t.id?.toLowerCase() || "").includes(searchQuery.toLowerCase())
      );
      const allTickets = filteredTickets;
      
      // Calculate financials from state
      const confirmedPayments = payments.filter(p => p.status === 'confirmed');
      const financials = {
        totalVolume: confirmedPayments.reduce((acc, p) => acc + p.amountTotal, 0),
        platformRevenue: confirmedPayments.reduce((acc, p) => acc + p.platformFee, 0),
        techPayouts: confirmedPayments.reduce((acc, p) => acc + p.techReceives, 0),
        count: confirmedPayments.length
      };

      const recentTransactions = [...confirmedPayments]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);

      const paginatedTickets = allTickets.slice((adminPage - 1) * ITEMS_PER_PAGE, adminPage * ITEMS_PER_PAGE);

      return (
        <div className="space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-900 text-white">
              <p className="text-xs opacity-60 uppercase font-bold mb-1">Volume Total</p>
              <p className="text-2xl font-bold">R$ {financials.totalVolume.toFixed(2)}</p>
            </Card>
            <Card className="bg-blue-600 text-white">
              <p className="text-xs opacity-60 uppercase font-bold mb-1">Receita Plataforma</p>
              <p className="text-2xl font-bold">R$ {financials.platformRevenue.toFixed(2)}</p>
            </Card>
            <Card className="bg-emerald-600 text-white">
              <p className="text-xs opacity-60 uppercase font-bold mb-1">Pagos a Técnicos</p>
              <p className="text-2xl font-bold">R$ {financials.techPayouts.toFixed(2)}</p>
            </Card>
            <Card className="bg-slate-100">
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Transações</p>
              <p className="text-2xl font-bold text-slate-800">{financials.count}</p>
            </Card>
          </section>

          <section className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                💳 Pagamentos Pendentes
                {pendingPayments.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingPayments.length}</span>}
              </h2>
              <div className="grid gap-4">
                {pendingPayments.map(p => (
                  <Card key={p.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">Total: R$ {p.amountTotal.toFixed(2)}</p>
                      <p className="text-sm text-slate-500">Ticket: {p.ticketId}</p>
                      <div className="mt-2 p-2 bg-slate-100 rounded text-xs italic">
                        Comprovante (Texto): {p.proofText || 'Nenhum texto enviado'}
                      </div>
                      {p.proofImageUrl && (
                        <button 
                          className="mt-2 text-blue-600 text-xs font-bold hover:underline"
                          onClick={() => window.open(p.proofImageUrl, '_blank')}
                        >
                          Ver Imagem do Comprovante
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={() => confirmPayment(p.id)}>Confirmar</Button>
                      <Button variant="danger" onClick={() => rejectPayment(p.id)}>Rejeitar</Button>
                    </div>
                  </Card>
                ))}
                {pendingPayments.length === 0 && <p className="text-slate-500 italic">Nenhum pagamento aguardando confirmação.</p>}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Últimas Transações</h2>
              <div className="space-y-3">
                {recentTransactions.map(p => (
                  <div key={p.id} className="p-3 bg-white border rounded-lg text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold">R$ {p.amountTotal.toFixed(2)}</p>
                      <p className="text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">CONFIRMADO</span>
                  </div>
                ))}
                {recentTransactions.length === 0 && <p className="text-slate-400 italic text-sm">Nenhuma transação confirmada.</p>}
              </div>
            </div>
          </section>

          {disputedTickets.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4 text-red-600 flex items-center gap-2">
                ⚠️ Tickets em Disputa
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{disputedTickets.length}</span>
              </h2>
              <div className="grid gap-4">
                {disputedTickets.map(t => (
                  <Card key={t.id} className="border-red-200 bg-red-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold">{t.title}</h3>
                        <p className="text-sm text-red-700 mt-1">Motivo: {t.disputeReason}</p>
                      </div>
                      <Button variant="outline" onClick={() => { setSelectedTicketId(t.id); setView('ticket'); }}>Intervir</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <h2 className="text-2xl font-bold">🎫 Todos os Tickets</h2>
              <div className="relative w-full md:w-64">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                  type="text" 
                  placeholder="Buscar tickets..." 
                  className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setAdminPage(1); }}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {paginatedTickets.map(t => (
                <Card key={t.id}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{t.title}</h3>
                    <Badge status={t.status}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{t.description}</p>
                  <div className="flex gap-2 items-center">
                    {!t.techId && (
                      <Button variant="outline" className="text-sm" onClick={async () => {
                        const techEmail = prompt("Digite o email do técnico para atribuir:");
                        if (techEmail) {
                          const allUsers = await database.users.getAll();
                          const tech = allUsers.find(u => u.email === techEmail && u.role === 'tech');
                          if (tech) assignTech(t.id, tech.uid);
                          else alert("Técnico não encontrado.");
                        }
                      }}>Atribuir Técnico</Button>
                    )}
                    <Button variant="outline" className="text-sm" onClick={() => { setSelectedTicketId(t.id); setView('ticket'); }}>Ver Detalhes</Button>
                  </div>
                </Card>
              ))}
            </div>
            <Pagination 
              currentPage={adminPage} 
              totalItems={allTickets.length} 
              itemsPerPage={ITEMS_PER_PAGE} 
              onPageChange={setAdminPage} 
            />
          </section>
        </div>
      );
    }

    if (role === 'client') {
      const myTickets = tickets.filter(t => t.clientId === currentUser.uid);
      const filteredMyTickets = myTickets.filter(t => 
        (t.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
        (t.description?.toLowerCase() || "").includes(searchQuery.toLowerCase())
      );
      return (
        <div className="space-y-8">
          <Card className="bg-blue-600 text-white border-none">
            <h2 className="text-xl font-bold mb-4">Precisa de assistência técnica?</h2>
            <form onSubmit={async (e: any) => {
              e.preventDefault();
              const imageFile = e.target.image.files[0];
              await createTicket(e.target.title.value, e.target.description.value, e.target.category.value, imageFile);
              e.target.reset();
            }} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <input name="title" placeholder="Resumo do problema" className="p-2 rounded text-slate-900 w-full" required />
                <select name="category" className="p-2 rounded text-slate-900 w-full" required>
                  <option value="Outros">Auto-Categorizar (IA)</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <textarea name="description" placeholder="Descreva o que está acontecendo..." className="p-2 rounded text-slate-900 w-full h-24" required />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold opacity-80">Anexar Foto do Problema (Opcional):</label>
                <input type="file" name="image" accept="image/*" className="text-xs" />
              </div>
              <Button type="submit" variant="secondary" className="w-full md:w-auto" disabled={isCategorizing}>
                {isCategorizing ? 'Analisando...' : 'Criar Chamado'}
              </Button>
            </form>
          </Card>

          <section>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <h2 className="text-2xl font-bold">Seus Chamados</h2>
              <div className="relative w-full md:w-64">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                  type="text" 
                  placeholder="Buscar seus chamados..." 
                  className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {filteredMyTickets.map(t => (
                <Card key={t.id} className="hover:border-blue-300 transition-colors cursor-pointer" onClick={() => { setSelectedTicketId(t.id); setView('ticket'); }}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{t.title}</h3>
                    <Badge status={t.status}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">Categoria: {t.category}</p>
                </Card>
              ))}
              {filteredMyTickets.length === 0 && <p className="text-slate-500 italic">Nenhum chamado encontrado.</p>}
            </div>
          </section>
        </div>
      );
    }

    if (role === 'tech') {
      const myAssignedTickets = tickets.filter(t => t.techId === currentUser.uid);
      const availableTickets = tickets.filter(t => t.status === 'open' && !t.techId);
      
      const showAssigned = techFilter === 'all' || techFilter !== 'open';
      const showAvailable = techFilter === 'all' || techFilter === 'open';

      const filteredAssigned = myAssignedTickets.filter(t => {
        const statusMatch = techFilter === 'all' ? true : t.status === techFilter;
        const categoryMatch = techCategoryFilter === 'all' ? true : t.category === techCategoryFilter;
        const searchMatch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
        return statusMatch && categoryMatch && searchMatch;
      });

      const filteredAvailable = availableTickets.filter(t => {
        const categoryMatch = techCategoryFilter === 'all' ? true : t.category === techCategoryFilter;
        const searchMatch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
        return categoryMatch && searchMatch;
      });

      const paginatedAssigned = filteredAssigned.slice((techAssignedPage - 1) * ITEMS_PER_PAGE, techAssignedPage * ITEMS_PER_PAGE);
      const paginatedAvailable = filteredAvailable.slice((techAvailablePage - 1) * ITEMS_PER_PAGE, techAvailablePage * ITEMS_PER_PAGE);

      const techPayments = payments.filter(p => p.techId === currentUser.uid && p.status === 'confirmed');
      const techFinancials = {
        totalEarned: techPayments.filter(p => {
          const t = tickets.find(ticket => ticket.id === p.ticketId);
          return t?.status === 'completed';
        }).reduce((acc, p) => acc + p.techReceives, 0),
        pendingBalance: techPayments.filter(p => {
          const t = tickets.find(ticket => ticket.id === p.ticketId);
          return t?.status !== 'completed';
        }).reduce((acc, p) => acc + p.techReceives, 0),
        monthlyEarned: techPayments.filter(p => {
          const t = tickets.find(ticket => ticket.id === p.ticketId);
          const date = new Date(p.updatedAt || p.createdAt);
          const now = new Date();
          return t?.status === 'completed' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).reduce((acc, p) => acc + p.techReceives, 0)
      };

      return (
        <div className="space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-emerald-600 text-white border-none shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs opacity-70 uppercase font-bold mb-1">Total Ganho</p>
                  <p className="text-3xl font-bold">R$ {techFinancials.totalEarned.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-white/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
              </div>
            </Card>
            <Card className="bg-blue-600 text-white border-none shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs opacity-70 uppercase font-bold mb-1">Saldo a Receber</p>
                  <p className="text-3xl font-bold">R$ {techFinancials.pendingBalance.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-white/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
              <p className="text-[10px] mt-2 opacity-60 italic">* Pagamentos confirmados de serviços em andamento.</p>
            </Card>
            <Card className="bg-slate-900 text-white border-none shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs opacity-70 uppercase font-bold mb-1">Ganhos no Mês</p>
                  <p className="text-3xl font-bold">R$ {techFinancials.monthlyEarned.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-white/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
              </div>
            </Card>
          </section>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Painel do Técnico</h2>
              <p className="text-sm text-slate-500">Gerencie seus atendimentos e encontre novos chamados.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                  type="text" 
                  placeholder="Buscar chamados..." 
                  className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setTechAssignedPage(1); setTechAvailablePage(1); }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</label>
                <select 
                  value={techFilter} 
                  onChange={(e) => setTechFilter(e.target.value)}
                  className="p-2 border rounded-lg bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                >
                  <option value="all">Todos</option>
                  <option value="open">Aberto (Disponíveis)</option>
                  <option value="assigned">Atribuído</option>
                  <option value="in_progress">Em Execução</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria:</label>
                <select 
                  value={techCategoryFilter} 
                  onChange={(e) => setTechCategoryFilter(e.target.value)}
                  className="p-2 border rounded-lg bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                >
                  <option value="all">Todas as Categorias</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {showAssigned && (
            <section>
              <h2 className="text-xl font-bold mb-4 text-slate-700 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                Seus Tickets {techFilter !== 'all' && techFilter !== 'open' ? `(${TICKET_STATUS_LABELS[techFilter as TicketStatus]})` : ''}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedAssigned.map(t => (
                  <TechTicketCard 
                    key={t.id} 
                    ticket={t} 
                    onClick={() => { setSelectedTicketId(t.id); setView('ticket'); }} 
                  />
                ))}
                {filteredAssigned.length === 0 && <p className="text-slate-500 italic p-4 bg-white border border-dashed rounded-xl col-span-full text-center">Nenhum ticket encontrado para estes filtros.</p>}
              </div>
              <Pagination 
                currentPage={techAssignedPage} 
                totalItems={filteredAssigned.length} 
                itemsPerPage={ITEMS_PER_PAGE} 
                onPageChange={setTechAssignedPage} 
              />
            </section>
          )}

          {showAvailable && (
            <section>
              <h2 className="text-xl font-bold mb-4 text-slate-700 flex items-center gap-2">
                <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                Tickets em Aberto (Disponíveis)
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedAvailable.map(t => (
                  <TechTicketCard 
                    key={t.id} 
                    ticket={t} 
                    onClick={() => { setSelectedTicketId(t.id); setView('ticket'); }}
                    actionButton={
                      <Button variant="primary" className="text-xs py-1 px-3 bg-emerald-600 hover:bg-emerald-700" onClick={() => acceptTicket(t.id)}>
                        Aceitar Ticket
                      </Button>
                    }
                  />
                ))}
                {filteredAvailable.length === 0 && <p className="text-slate-500 italic p-4 bg-white border border-dashed rounded-xl col-span-full text-center">Nenhum ticket em aberto encontrado para estes filtros.</p>}
              </div>
              <Pagination 
                currentPage={techAvailablePage} 
                totalItems={filteredAvailable.length} 
                itemsPerPage={ITEMS_PER_PAGE} 
                onPageChange={setTechAvailablePage} 
              />
            </section>
          )}
        </div>
      );
    }

    return (
      <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-inner">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Perfil não configurado</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          Não encontramos conteúdo específico para o seu nível de acesso: <span className="font-mono font-bold text-blue-600 px-2 py-1 bg-blue-50 rounded">{role}</span>.
        </p>
        <div className="text-xs text-slate-400 font-mono bg-slate-50 p-4 rounded-lg inline-block text-left">
          <p className="font-bold mb-1 border-b pb-1">Debug Info:</p>
          <p>UID: {currentUser.uid}</p>
          <p>Email: {currentUser.email}</p>
          <p>Role: {currentUser.role}</p>
          <p>Normalized Role: {role}</p>
          <p>Tickets: {tickets.length}</p>
          <p>Payments: {payments.length}</p>
        </div>
      </div>
    );
  };

  const renderTicketDetail = () => {
    if (!selectedTicketId || !currentUser) return null;
    const ticket = tickets.find(t => t.id === selectedTicketId);
    if (!ticket) return <p>Ticket não encontrado.</p>;

    // For simplicity in this real-time version, we'll use a local state for messages in this view
    // or just rely on the fact that we'll add a listener here.
    return <TicketDetailView 
      ticket={ticket} 
      currentUser={currentUser} 
      onBack={() => setView('dashboard')}
      onSendMessage={sendMessage}
      onSetBudget={setBudget}
      onSubmitProof={submitPaymentProof}
      onConfirmPayment={confirmPayment}
      onRejectPayment={rejectPayment}
      onStartExecution={(tid) => database.tickets.update(tid, { status: 'in_progress' })}
      onDispute={disputeTicket}
      onResolveDispute={resolveDispute}
      onFinish={(tid) => database.tickets.update(tid, { status: 'completed' })}
      onRate={rateTechnician}
      onDelete={(tid: string) => setDeleteModal({ isOpen: true, ticketId: tid })}
      onUpdate={(tid: string, updates: any) => database.tickets.update(tid, updates)}
      onPayWithStripe={handlePayWithStripe}
      isProcessingPayment={isProcessingPayment}
      payment={payments.find(p => p.ticketId === ticket.id)}
    />;
  };

  const renderAdminLogs = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Histórico de Auditoria</h2>
        <Button variant="outline" onClick={() => setView('dashboard')}>Dashboard</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Data</th>
                <th>Ator</th>
                <th>Ação</th>
                <th>Alvo</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b hover:bg-slate-50">
                  <td className="py-2 opacity-50">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="font-medium">{log.actorId}</td>
                  <td><span className="bg-slate-200 px-1 rounded font-mono">{log.action}</span></td>
                  <td className="opacity-75">{log.targetRef}</td>
                  <td className="italic">{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderProfile = () => {
    if (!currentUser) return null;

    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => setView('dashboard')}>← Voltar</Button>
          <h2 className="text-3xl font-extrabold">Seu Perfil</h2>
        </div>

        <Card>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase">Email (Não editável)</label>
                <input 
                  type="email" 
                  value={currentUser.email} 
                  disabled 
                  className="w-full p-3 bg-slate-100 border rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase">Função</label>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 font-bold uppercase text-xs">
                  {currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'tech' ? 'Técnico' : 'Cliente'}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase">Nome Completo</label>
                <input 
                  type="text" 
                  value={profileName} 
                  onChange={e => setProfileName(e.target.value)} 
                  placeholder="Seu nome"
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  value={profilePhone} 
                  onChange={e => setProfilePhone(e.target.value)} 
                  placeholder="(00) 00000-0000"
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button type="submit" className="w-full md:w-auto px-8" disabled={isSavingProfile}>
                {isSavingProfile ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Card>

        {currentUser.role === 'tech' && (
          <Card className="bg-blue-600 text-white border-none">
            <h3 className="font-bold text-lg mb-2">Estatísticas de Técnico</h3>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/10 p-4 rounded-xl">
                <p className="text-xs opacity-70 uppercase font-bold">Avaliação Média</p>
                <p className="text-2xl font-bold">{currentUser.rating?.toFixed(1) || 'N/A'}</p>
              </div>
              <div className="bg-white/10 p-4 rounded-xl">
                <p className="text-xs opacity-70 uppercase font-bold">Total de Atendimentos</p>
                <p className="text-2xl font-bold">{currentUser.totalRatings || 0}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  };

  // --- Main Layout ---

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );

  if (view === 'landing') return <LandingPage onStart={() => setView('auth')} />;
  if (view === 'auth' || !currentUser) return <AuthPage onLogin={(u) => { setCurrentUser(u); setView('dashboard'); }} />;

  return (
    <div className="min-h-screen flex flex-col">
      <ConfirmationModal 
        isOpen={deleteModal.isOpen}
        title="Excluir Ticket"
        message="Tem certeza que deseja excluir este ticket permanentemente? Esta ação não pode ser desfeita."
        onConfirm={handleDeleteTicket}
        onCancel={() => setDeleteModal({ isOpen: false, ticketId: null })}
        loading={isDeleting}
      />
      <SupportModal 
        isOpen={showSupport} 
        onClose={() => setShowSupport(false)} 
      />
      <InstitutionalModal 
        isOpen={!!institutionalPage} 
        page={institutionalPage} 
        onClose={() => setInstitutionalPage(null)} 
      />
      <header className="bg-blue-600 border-b sticky top-0 z-50 text-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setView('dashboard'); setSearchQuery(''); }}>
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-blue-600 font-bold">R</div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline">RemotoTech</span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell 
              count={notifications.filter(n => !n.read).length} 
              onClick={() => setShowNotifications(!showNotifications)} 
            />
            <div 
              className="flex items-center gap-2 cursor-pointer hover:bg-blue-700 p-1 rounded-lg transition-colors"
              onClick={() => setView('profile')}
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                {currentUser.name ? currentUser.name.substring(0, 1).toUpperCase() : (currentUser.email?.substring(0, 1).toUpperCase() || '?')}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-bold text-white leading-none">{currentUser.name || 'Seu Perfil'}</span>
                <span className="text-[10px] text-blue-200 uppercase font-bold">{currentUser.role}</span>
              </div>
            </div>
            {currentUser.role.toLowerCase() === 'admin' && (
              <Button variant="outline" className="text-xs border-white text-white hover:bg-blue-700" onClick={() => setView('admin_logs')}>Logs</Button>
            )}
            <Button variant="outline" className="text-xs hidden sm:flex items-center gap-1 border-white text-white hover:bg-blue-700" onClick={() => setShowSupport(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Suporte
            </Button>
            <Button variant="outline" className="text-xs border-white text-white hover:bg-blue-700" onClick={handleLogout}>Sair</Button>
          </div>
        </div>
        
        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute right-4 top-16 w-80 bg-white border rounded-xl shadow-xl z-[60] max-h-[400px] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">Notificações</h3>
              <button className="text-xs text-blue-600" onClick={() => notifications.forEach(n => database.notifications.markAsRead(n.id))}>Marcar todas como lidas</button>
            </div>
            {notifications.map(n => (
              <div 
                key={n.id} 
                className={`p-4 border-b last:border-none cursor-pointer hover:bg-slate-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                onClick={() => {
                  database.notifications.markAsRead(n.id);
                  if (n.link) {
                    setSelectedTicketId(n.link);
                    setView('ticket');
                  }
                  setShowNotifications(false);
                }}
              >
                <p className="text-sm font-bold">{n.title}</p>
                <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                <p className="text-[10px] text-slate-400 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {notifications.length === 0 && <p className="p-8 text-center text-slate-400 italic">Nenhuma notificação.</p>}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {view === 'dashboard' && renderDashboard()}
        {view === 'ticket' && renderTicketDetail()}
        {view === 'admin_logs' && renderAdminLogs()}
        {view === 'profile' && renderProfile()}
      </main>

      <footer className="bg-slate-100 border-t py-8 mt-12 text-center text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-8 mb-8 text-left">
          <div>
            <h4 className="font-bold text-slate-800 mb-3">RemotoTech</h4>
            <p className="text-xs leading-relaxed">A maior plataforma de intermediação de assistência técnica online do Brasil. Conectando você aos melhores especialistas.</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-3">Links Úteis</h4>
            <ul className="text-xs space-y-2">
              <li><button onClick={() => setView('dashboard')} className="hover:text-blue-600 transition-colors">Dashboard</button></li>
              <li><button onClick={() => setInstitutionalPage('faq')} className="hover:text-blue-600 transition-colors">Perguntas Frequentes (FAQ)</button></li>
              <li><button onClick={() => setInstitutionalPage('terms')} className="hover:text-blue-600 transition-colors">Termos de Uso</button></li>
              <li><button onClick={() => setInstitutionalPage('privacy')} className="hover:text-blue-600 transition-colors">Privacidade</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-3">Contato de Suporte</h4>
            <p className="text-xs mb-1">E-mail: <span className="text-slate-600">suporte@remototech.com</span></p>
            <p className="text-xs mb-1">WhatsApp: <span className="text-slate-600">(11) 99999-9999</span></p>
            <p className="text-[10px] mt-2 italic">Atendimento: Seg-Sex 09h às 18h</p>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-6">
          <p>© 2024 RemotoTech - Intermediação de Assistência Técnica Online.</p>
          <p className="mt-1">Segurança • Transparência • Eficiência</p>
          <button 
            onClick={async () => { 
              await signOut(auth);
              localStorage.clear(); 
              window.location.reload(); 
            }}
            className="mt-4 text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
          >
            [ Resetar Dados e Sair ]
          </button>
        </div>
      </footer>
    </div>
  );
}
