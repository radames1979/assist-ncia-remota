
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
  open: "Aberto",
  assigned: "Técnico Atribuído",
  awaiting_payment: "Aguardando Pagamento",
  paid: "Pago / Liberado",
  in_progress: "Em Execução",
  completed: "Concluído",
  cancelled: "Cancelado"
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  proof_submitted: "Comprovante Enviado",
  confirmed: "Confirmado",
  rejected: "Rejeitado"
};
