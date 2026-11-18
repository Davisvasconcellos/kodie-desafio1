import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeText } from './geminiService.js';
import { saveAnalysis, getHistory, clearHistory } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir frontend estático se estiver na mesma raiz
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'KODIE Desafio 1 - API de Triagem Inteligente',
    timestamp: new Date().toISOString()
  });
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend rodando em http://localhost:${PORT}`);
});

