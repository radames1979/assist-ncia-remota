
export const PLATFORM_FEE_PCT = 20;

export const CATEGORIES = [
  "Software/Windows",
  "Otimização/Lentidão",
  "Remoção de Vírus",
  "Configuração de Rede",
  "Desenvolvimento/Código",
  "Consultoria Técnica",
  "Outros"
];

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Aguardando Análise Admin",
  pending_tech_acceptance: "Aguardando Analista",
  assigned: "Analista Atribuído",
  awaiting_payment: "Aguardando Pagamento",
  paid: "Pagamento Confirmado",
  in_progress: "Em Execução / Dados Liberados",
  completed: "Concluído",
  cancelled: "Cancelado",
  disputed: "Em Disputa"
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  proof_submitted: "Comprovante Enviado",
  confirmed: "Confirmado",
  rejected: "Rejeitado"
};
