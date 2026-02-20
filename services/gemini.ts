
import { GoogleGenAI, Type } from "@google/genai";

// Lazy initialization to prevent crash if API_KEY is missing
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.VITE_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY não encontrada. As funções de IA estarão desativadas.");
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const analyzeMessageSafety = async (text: string): Promise<{ isSafe: boolean; reason?: string }> => {
  const ai = getAI();
  if (!ai) return { isSafe: true };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise se a seguinte mensagem de chat de suporte técnico contém informações de contato proibidas (telefone, email, links externos de redes sociais, chaves PIX). Responda apenas com um JSON válido contendo os campos "isSafe" (booleano) e "reason" (string opcional em português se não for seguro). 
      
      Mensagem: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ["isSafe"]
        }
      }
    });

    return JSON.parse(response.text || '{"isSafe": true}');
  } catch (error) {
    console.error("Gemini safety check failed", error);
    return { isSafe: true };
  }
};

export const suggestCategory = async (description: string): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Outros";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base na descrição de um problema técnico, sugira a melhor categoria entre: "Hardware", "Software", "Rede", "Segurança", "Outros". Responda apenas com o nome da categoria.
      
      Descrição: "${description}"`,
    });
    return response.text?.trim() || "Outros";
  } catch {
    return "Outros";
  }
};

export const summarizeAuditLog = async (action: string, details: string): Promise<string> => {
  const ai = getAI();
  if (!ai) return action;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Gere uma breve descrição (máximo 15 palavras) para um log de auditoria. Ação: ${action}. Detalhes: ${details}`,
    });
    return response.text || action;
  } catch {
    return action;
  }
};
