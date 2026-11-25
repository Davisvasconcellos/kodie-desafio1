import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_INSTRUCTION = `
Você é um assistente sênior especialista em triagem, atendimento ao cliente e classificação operacional de mensagens corporativas.
Sua tarefa é analisar o texto recebido (que pode ser uma mensagem de cliente, e-mail, reclamação, relatório ou documento) e retornar EXCLUSIVAMENTE um objeto JSON válido, sem blocos markdown adicionais, sem preâmbulo e sem explicações externas.

Estrutura JSON obrigatória:
{
  "categoria": "Dúvida" | "Reclamação" | "Solicitação" | "Financeiro" | "Elogio" | "Outro",
  "prioridade": "Baixa" | "Média" | "Alta" | "Crítica",
  "departamento": "Suporte Técnico" | "Financeiro" | "Atendimento ao Cliente" | "Vendas" | "Operações" | "Diretoria",
  "sentimento": "Positivo" | "Neutro" | "Negativo" | "Urgente",
  "resumo": "Resumo executivo claro e direto em 1 ou 2 frases destacando o ponto central.",
  "pontos_chave": [
    "Item ou argumento principal 1",
    "Item ou argumento principal 2"
  ],
  "acao_recomendada": "Ação prática recomendada para o operador que receber este chamado.",
  "resposta_sugerida": "Uma sugestão de resposta profissional, empática e personalizada para enviar ao cliente/remetente."
}

Regras para prioridade:
- "Crítica": Envolve ameaça de processo judicial, prejuízo financeiro grave iminente, sistema central inoperante ou clientes extremamente exaltados.
- "Alta": Reclamações graves, cobranças indevidas, clientes cancelando serviço ou prazos vencidos.
- "Média": Dúvidas operacionais importantes, solicitações comuns com impacto no dia a dia.
- "Baixa": Dúvidas simples, elogios, informativos gerais.
`;

/**
 * Executa a análise inteligente de texto com o Gemini, com fallback automático de modelos
 */
export async function analyzeText(text, userApiKey = null) {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Chave da API do Google Gemini não fornecida. Configure no .env ou informe na interface.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  
  // Lista de modelos ordenados por prioridade e fallback
  const modelsToTry = [
    preferredModel,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-2.5-flash'
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const prompt = `Analise a seguinte mensagem/documento:\n\n"""\n${text}\n"""`;

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        }
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse limpo do JSON
      try {
        return JSON.parse(responseText);
      } catch {
        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      }
    } catch (err) {
      // Se for erro de chave inválida, encerra direto
      if (err.message && err.message.includes('API_KEY_INVALID')) {
        throw new Error('Chave da API do Gemini inválida (API_KEY_INVALID).');
      }

      console.warn(`Aviso: Modelo "${modelName}" indisponível: ${err.message}. Tentando próximo modelo...`);
      lastError = err;
    }
  }

  throw lastError || new Error('Não foi possível obter resposta dos modelos Gemini.');
}
