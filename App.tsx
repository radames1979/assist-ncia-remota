
import React, { useState, useEffect } from 'react';
import { User, Ticket, Payment, Message, UserRole, TicketStatus, PaymentStatus } from './types';
import { db } from './services/mockDb';
import { PLATFORM_FEE_PCT, TICKET_STATUS_LABELS, CATEGORIES, PAYMENT_STATUS_LABELS } from './constants';
import { analyzeMessageSafety, summarizeAuditLog } from './services/gemini';

// --- UI Components ---

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

// --- App Pages ---

const LandingPage = ({ onStart }: { onStart: () => void }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6 text-center">
    <div className="max-w-3xl">
      <h1 className="text-5xl font-extrabold text-slate-900 mb-6">Assistência Técnica <span className="text-blue-600">Remota</span></h1>
      <p className="text-xl text-slate-600 mb-8">Conectando problemas de hardware e software com técnicos especialistas, sem precisar sair de casa.</p>
      <div className="flex gap-4 justify-center">
        <Button onClick={onStart} className="text-lg px-8 py-4">Entrar na Plataforma</Button>
      </div>
    </div>
  </div>
);

const AuthPage = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState<UserRole>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      const newUser: User = { uid: `u-${Date.now()}`, email, role, status: 'active', createdAt: Date.now() };
      db.users.add(newUser);
      onLogin(newUser);
    } else {
      const user = db.users.getAll().find(u => u.email === email);
      if (user) onLogin(user);
      else alert("Usuário não encontrado.");
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
          <Button type="submit" className="w-full">{isRegister ? 'Cadastrar' : 'Entrar'}</Button>
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
  const [view, setView] = useState<'landing' | 'auth' | 'dashboard' | 'ticket' | 'admin_logs'>('landing');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Navigation and Refresh
  const refreshData = () => {
    if (!currentUser) return;
    setTickets(db.tickets.getAll());
    setPayments(db.payments.getAll());
  };

  useEffect(() => {
    refreshData();
  }, [currentUser, view]);

  const handleLogout = () => {
    setCurrentUser(null);
    setView('landing');
  };

  const createTicket = (title: string, category: string, description: string) => {
    if (!currentUser) return;
    const newTicket: Ticket = {
      id: `t-${Date.now()}`,
      clientId: currentUser.uid,
      status: 'open',
      title,
      category,
      description,
      platformFeePct: PLATFORM_FEE_PCT,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.tickets.add(newTicket);
    db.logs.add({ id: `l-${Date.now()}`, actorId: currentUser.uid, action: 'CREATE_TICKET', targetRef: newTicket.id, createdAt: Date.now() });
    refreshData();
  };

  const assignTech = (ticketId: string, techId: string) => {
    db.tickets.update(ticketId, { techId, status: 'assigned' });
    db.logs.add({ id: `l-${Date.now()}`, actorId: currentUser?.uid || '', action: 'ASSIGN_TECH', targetRef: ticketId, details: `Tech: ${techId}`, createdAt: Date.now() });
    refreshData();
  };

  const setBudget = (ticketId: string, amount: number) => {
    const ticket = db.tickets.getById(ticketId);
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
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    db.payments.add(newPayment);
    db.tickets.update(ticketId, { budgetAmount: amount, budgetType: 'fixed', status: 'awaiting_payment' });
    refreshData();
  };

  const submitPaymentProof = (paymentId: string, proofText: string) => {
    db.payments.update(paymentId, { proofText, status: 'proof_submitted' });
    refreshData();
  };

  const confirmPayment = (paymentId: string) => {
    const payment = db.payments.getById(paymentId);
    if (!payment) return;
    db.payments.update(paymentId, { status: 'confirmed', confirmedBy: currentUser?.uid, confirmedAt: Date.now() });
    db.tickets.update(payment.ticketId, { status: 'paid' });
    db.logs.add({ id: `l-${Date.now()}`, actorId: currentUser?.uid || '', action: 'CONFIRM_PAYMENT', targetRef: paymentId, createdAt: Date.now() });
    refreshData();
  };

  const rejectPayment = (paymentId: string) => {
    db.payments.update(paymentId, { status: 'rejected' });
    refreshData();
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
    db.chats.addMessage(ticketId, newMessage);
    refreshData();
  };

  // --- Views ---

  const renderDashboard = () => {
    if (!currentUser) return null;

    if (currentUser.role === 'admin') {
      const pendingPayments = payments.filter(p => p.status === 'proof_submitted');
      const allTickets = tickets;
      const allUsers = db.users.getAll();

      return (
        <div className="space-y-8">
          <section>
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
                      Comprovante (Texto): {p.proofText}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => confirmPayment(p.id)}>Confirmar</Button>
                    <Button variant="danger" onClick={() => rejectPayment(p.id)}>Rejeitar</Button>
                  </div>
                </Card>
              ))}
              {pendingPayments.length === 0 && <p className="text-slate-500 italic">Nenhum pagamento aguardando confirmação.</p>}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">🎫 Todos os Tickets</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {allTickets.map(t => (
                <Card key={t.id}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{t.title}</h3>
                    <Badge status={t.status}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{t.description}</p>
                  <div className="flex gap-2 items-center">
                    {!t.techId && (
                      <select 
                        onChange={(e) => assignTech(t.id, e.target.value)}
                        className="p-1 text-sm border rounded"
                        defaultValue=""
                      >
                        <option value="" disabled>Atribuir Técnico...</option>
                        {allUsers.filter(u => u.role === 'tech').map(u => (
                          <option key={u.uid} value={u.uid}>{u.email}</option>
                        ))}
                      </select>
                    )}
                    <Button variant="outline" className="text-sm" onClick={() => { setSelectedTicketId(t.id); setView('ticket'); }}>Ver Detalhes</Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (currentUser.role === 'client') {
      const myTickets = tickets.filter(t => t.clientId === currentUser.uid);
      return (
        <div className="space-y-8">
          <Card className="bg-blue-600 text-white border-none">
            <h2 className="text-xl font-bold mb-4">Precisa de assistência técnica?</h2>
            <form onSubmit={(e: any) => {
              e.preventDefault();
              createTicket(e.target.title.value, e.target.category.value, e.target.description.value);
              e.target.reset();
            }} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <input name="title" placeholder="Resumo do problema" className="p-2 rounded text-slate-900 w-full" required />
                <select name="category" className="p-2 rounded text-slate-900 w-full" required>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <textarea name="description" placeholder="Descreva o que está acontecendo..." className="p-2 rounded text-slate-900 w-full h-24" required />
              <Button type="submit" variant="secondary" className="w-full md:w-auto">Criar Chamado</Button>
            </form>
          </Card>

          <section>
            <h2 className="text-2xl font-bold mb-4">Seus Chamados</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {myTickets.map(t => (
                <Card key={t.id} className="hover:border-blue-300 transition-colors cursor-pointer" onClick={() => { setSelectedTicketId(t.id); setView('ticket'); }}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{t.title}</h3>
                    <Badge status={t.status}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">Categoria: {t.category}</p>
                </Card>
              ))}
              {myTickets.length === 0 && <p className="text-slate-500 italic">Você ainda não criou nenhum chamado.</p>}
            </div>
          </section>
        </div>
      );
    }

    if (currentUser.role === 'tech') {
      const myAssignedTickets = tickets.filter(t => t.techId === currentUser.uid);
      const availableTickets = tickets.filter(t => t.status === 'open' && !t.techId);
      return (
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">Tickets Atribuídos a Você</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {myAssignedTickets.map(t => (
                <Card key={t.id} className="hover:border-blue-300 transition-colors cursor-pointer" onClick={() => { setSelectedTicketId(t.id); setView('ticket'); }}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{t.title}</h3>
                    <Badge status={t.status}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Cliente ID: {t.clientId}</p>
                  {t.budgetAmount && <p className="text-sm font-bold text-green-600">Orc: R$ {t.budgetAmount.toFixed(2)}</p>}
                </Card>
              ))}
              {myAssignedTickets.length === 0 && <p className="text-slate-500 italic">Nenhum ticket atribuído ainda.</p>}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-slate-400">Tickets em Aberto (Aguardando Admin)</h2>
            <div className="grid md:grid-cols-2 gap-4 opacity-75">
              {availableTickets.map(t => (
                <Card key={t.id}>
                  <h3 className="font-bold">{t.title}</h3>
                  <p className="text-xs text-slate-400 italic">Somente o Admin pode atribuir você a este ticket.</p>
                </Card>
              ))}
            </div>
          </section>
        </div>
      );
    }
  };

  const renderTicketDetail = () => {
    if (!selectedTicketId || !currentUser) return null;
    const ticket = db.tickets.getById(selectedTicketId);
    if (!ticket) return <p>Ticket não encontrado.</p>;

    const messages = db.chats.getMessages(ticket.id);
    const payment = db.payments.getByTicket(ticket.id);

    return (
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <Button variant="outline" onClick={() => setView('dashboard')}>← Voltar</Button>
              <Badge status={ticket.status}>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
            </div>
            <h1 className="text-3xl font-extrabold mb-2">{ticket.title}</h1>
            <p className="text-slate-600 bg-slate-50 p-4 rounded-lg whitespace-pre-wrap">{ticket.description}</p>
          </Card>

          {/* Chat System */}
          <Card className="flex flex-col h-[500px]">
            <h3 className="font-bold text-lg mb-4">Chat Interno (Seguro)</h3>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${m.senderId === currentUser.uid ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                    <p className="text-xs opacity-75 mb-1 font-bold">{m.senderRole.toUpperCase()}</p>
                    <p className="text-sm">{m.text}</p>
                    <p className="text-[10px] text-right mt-1 opacity-50">{new Date(m.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-center text-slate-400 italic mt-10">Inicie a conversa para alinhar o atendimento.</p>}
            </div>
            <form onSubmit={(e: any) => {
              e.preventDefault();
              sendMessage(ticket.id, e.target.msg.value);
              e.target.reset();
            }} className="flex gap-2 border-t pt-4">
              <input name="msg" placeholder="Digite sua mensagem..." className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              <Button type="submit">Enviar</Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-bold text-lg mb-4">Informações de Pagamento</h3>
            {!payment && currentUser.role === 'tech' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 italic">Defina o orçamento para o cliente realizar o pagamento via PIX.</p>
                <input type="number" id="budgetInput" placeholder="Valor Total (R$)" className="w-full p-2 border rounded" />
                <Button className="w-full" onClick={() => {
                  const val = parseFloat((document.getElementById('budgetInput') as HTMLInputElement).value);
                  if (val > 0) setBudget(ticket.id, val);
                }}>Enviar Orçamento</Button>
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
                  <div className="pt-4 border-t">
                    <p className="text-xs font-bold text-blue-700 mb-2 uppercase">Instruções:</p>
                    <p className="text-sm mb-4">Envie o PIX para a chave do Admin (PIX: financeiro@remototech.com) e cole o texto/ID do comprovante abaixo.</p>
                    <textarea id="proofInput" placeholder="Cole o texto do comprovante aqui..." className="w-full p-2 border rounded h-20 text-sm mb-2" />
                    <Button className="w-full" onClick={() => {
                      const proof = (document.getElementById('proofInput') as HTMLTextAreaElement).value;
                      if (proof) submitPaymentProof(payment.id, proof);
                    }}>Enviar Comprovante</Button>
                  </div>
                )}

                {currentUser.role === 'client' && payment.status === 'proof_submitted' && (
                  <p className="bg-amber-50 text-amber-800 p-3 rounded text-sm italic">Comprovante enviado! Aguarde o Admin confirmar para liberar o técnico.</p>
                )}

                {currentUser.role === 'tech' && payment.status === 'confirmed' && (
                  <div className="bg-green-100 text-green-800 p-3 rounded">
                    <p className="text-sm font-bold">Pagamento Confirmado!</p>
                    <p className="text-xs">Você receberá R$ {payment.techReceives.toFixed(2)} após a conclusão.</p>
                    <Button className="w-full mt-2" onClick={() => db.tickets.update(ticket.id, { status: 'in_progress' })}>Iniciar Execução</Button>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="bg-slate-900 text-white">
            <h3 className="font-bold mb-2">🛡️ Regras de Segurança</h3>
            <ul className="text-xs space-y-2 opacity-80">
              <li>• Jamais compartilhe WhatsApp ou redes sociais no chat.</li>
              <li>• O pagamento deve ser feito exclusivamente via plataforma.</li>
              <li>• O descumprimento gera suspensão imediata da conta.</li>
            </ul>
          </Card>
        </div>
      </div>
    );
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
              {db.logs.getAll().map(log => (
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

  // --- Main Layout ---

  if (view === 'landing') return <LandingPage onStart={() => setView('auth')} />;
  if (view === 'auth' || !currentUser) return <AuthPage onLogin={(u) => { setCurrentUser(u); setView('dashboard'); }} />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">R</div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline">RemotoTech</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden md:inline">Logado como: <span className="font-semibold text-slate-800">{currentUser.email} ({currentUser.role})</span></span>
            {currentUser.role === 'admin' && (
              <Button variant="outline" className="text-xs" onClick={() => setView('admin_logs')}>Logs</Button>
            )}
            <Button variant="outline" className="text-xs" onClick={handleLogout}>Sair</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {view === 'dashboard' && renderDashboard()}
        {view === 'ticket' && renderTicketDetail()}
        {view === 'admin_logs' && renderAdminLogs()}
      </main>

      <footer className="bg-slate-100 border-t py-6 mt-12 text-center text-slate-400 text-sm">
        <p>© 2024 RemotoTech - Intermediação de Assistência Técnica Online.</p>
        <p className="mt-1">Segurança • Transparência • Eficiência</p>
      </footer>
    </div>
  );
}
