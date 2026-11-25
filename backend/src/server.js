import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzeText } from './geminiService.js';
import { saveAnalysis, getHistory, clearHistory, getTodayAnalysisCount } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir frontend estático (unificado em container Docker ou desenvolvimento local)
const candidateStaticPaths = [
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, '..', '..', 'frontend'),
  path.join(__dirname, 'public')
];
for (const dir of candidateStaticPaths) {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir));
    break;
  }
}

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'KODIE Desafio 1 - API de Triagem Inteligente',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/config-status
 * Informa ao frontend se a edição de configurações críticas (Webhook e Chave de IA)
 * está permitida via variável de ambiente ALLOW_CONFIG_EDITS (padrão: false para proteção).
 */
app.get('/api/config-status', (req, res) => {
  const allowConfigEdits = process.env.ALLOW_CONFIG_EDITS === 'true';
  res.json({
    allowConfigEdits,
    defaultWebhookUrl: process.env.N8N_WEBHOOK_URL || 'https://n8n.dmedia.com.br/webhook/e7561c7e-44bb-4dcf-8a43-a8adca53ae32',
    hasServerApiKey: Boolean(process.env.GEMINI_API_KEY)
  });
});

/**
 * GET /api/llm-quota
 * Retorna as informações proativas de cota da LLM, modelo ativo e créditos restantes
 */
app.get('/api/llm-quota', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || process.env.GEMINI_API_KEY;
    const dailyLimit = Number(process.env.GEMINI_DAILY_LIMIT) || 500;
    const offset = Number(process.env.GEMINI_QUOTA_OFFSET) || 25; // inicializado com a contagem da conta
    const todayUsedInDb = getTodayAnalysisCount();
    const totalUsedToday = todayUsedInDb + offset;
    const remaining = Math.max(0, dailyLimit - totalUsedToday);
    const rpm = 15;

    if (!apiKey) {
      return res.json({
        success: true,
        status: 'no_key',
        model: 'Sem Chave',
        remaining: 0,
        dailyLimit,
        usedToday: 0,
        rpm: 0
      });
    }

    // Validação rápida de conectividade com a API do Google (sem gastar cota de geração)
    let isKeyHealthy = true;
    try {
      const probeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`);
      if (!probeRes.ok) {
        if (probeRes.status === 429) {
          return res.json({
            success: true,
            status: 'rate_limited',
            model: 'Gemini 3.5 Lite',
            remaining: 0,
            dailyLimit,
            usedToday: dailyLimit,
            rpm,
            message: 'Limite de taxa excedido na API (429)'
          });
        }
        if (probeRes.status === 400 || probeRes.status === 403) {
          isKeyHealthy = false;
        }
      }
    } catch {
      // Se a chamada externa falhar por rede transitória, não impede o cálculo das métricas locais
    }

    return res.json({
      success: true,
      status: isKeyHealthy ? (remaining > 0 ? 'active' : 'exhausted') : 'invalid_key',
      model: 'Gemini 3.5 Lite',
      modelFullName: 'Gemini 3.5 Flash Lite',
      remaining,
      dailyLimit,
      usedToday: totalUsedToday,
      rpm,
      percentRemaining: Math.round((remaining / dailyLimit) * 100)
    });
  } catch (error) {
    console.error('Erro ao verificar cota da LLM:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao calcular cota da LLM'
    });
  }
});

/**
 * POST /api/analyze
 * Recebe texto da mensagem ou documento, chama o Gemini e salva no SQLite.
 * Pode ser chamado diretamente pelo Frontend ou pelo n8n via HTTP Request node.
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, source = 'text', filename = null, apiKey = null } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'O campo "text" é obrigatório e não pode estar vazio.'
      });
    }

    // Aceita chave via header ou body ou fallback no .env
    const userApiKey = req.headers['x-api-key'] || apiKey || process.env.GEMINI_API_KEY;

    if (!userApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Chave de API do Gemini não configurada. Insira na aba de Configurações ou no arquivo .env do servidor.'
      });
    }

    // Chama o serviço de IA
    const analysis = await analyzeText(text, userApiKey);

    // Salva histórico no banco de dados SQLite
    const historyId = saveAnalysis({
      source,
      filename,
      inputText: text,
      result: analysis
    });

    return res.json({
      success: true,
      id: historyId,
      data: analysis
    });
  } catch (error) {
    console.error('Erro ao processar análise:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno ao processar a análise com IA.'
    });
  }
});

/**
 * GET /api/history
 * Lista as últimas análises processadas
 */
app.get('/api/history', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const items = getHistory(limit);
    return res.json({
      success: true,
      count: items.length,
      history: items
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao consultar histórico no banco de dados.'
    });
  }
});

/**
 * DELETE /api/history
 * Limpa o histórico de análises
 */
app.delete('/api/history', (req, res) => {
  try {
    clearHistory();
    return res.json({
      success: true,
      message: 'Histórico de análises limpo com sucesso.'
    });
  } catch (error) {
    console.error('Erro ao limpar histórico:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao limpar histórico.'
    });
  }
});

/**
 * POST /api/webhook-relay
 * Atua como intermediário seguro entre o Frontend e o n8n para evitar bloqueios de CORS no navegador.
 */
app.post('/api/webhook-relay', async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'A URL do Webhook é obrigatória.' });
    }

    const startTime = Date.now();
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload || {})
    });

    const elapsed = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';
    let responseData;
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    return res.status(response.status).json({
      success: response.ok,
      status: response.status,
      elapsed,
      data: responseData
    });
  } catch (error) {
    console.error('Erro no relay para o n8n:', error);
    return res.status(502).json({
      success: false,
      error: `Não foi possível conectar ao n8n: ${error.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend rodando em http://localhost:${PORT}`);
});

