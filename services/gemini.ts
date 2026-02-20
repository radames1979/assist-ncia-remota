
import { GoogleGenAI, Type } from "@google/genai";

// Fix: Strictly follow named parameter initialization for GoogleGenAI.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeMessageSafety = async (text: string): Promise<{ isSafe: boolean; reason?: string }> => {
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

    // Fix: Directly use the .text property from GenerateContentResponse as per guidelines.
    return JSON.parse(response.text || '{"isSafe": true}');
  } catch (error) {
    console.error("Gemini safety check failed", error);
    return { isSafe: true }; // Fallback to safe if API fails
  }
};

export const suggestCategory = async (description: string): Promise<string> => {
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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Gere uma breve descrição (máximo 15 palavras) para um log de auditoria. Ação: ${action}. Detalhes: ${details}`,
    });
    // Fix: Directly use the .text property from GenerateContentResponse as per guidelines.
    return response.text || action;
  } catch {
    return action;
  }
};
