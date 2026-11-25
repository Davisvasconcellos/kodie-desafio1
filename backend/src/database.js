import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Armazena o banco SQLite na raiz do backend
const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new DatabaseSync(dbPath);

// Cria tabela de histórico de análises se não existir
db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT DEFAULT 'text',
    filename TEXT,
    input_text TEXT NOT NULL,
    categoria TEXT,
    prioridade TEXT,
    departamento TEXT,
    sentimento TEXT,
    resumo TEXT,
    pontos_chave TEXT,
    resposta_sugerida TEXT,
    raw_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

/**
 * Salva uma análise no banco de dados SQLite
 */
export function saveAnalysis({ source = 'text', filename = null, inputText, result }) {
  const stmt = db.prepare(`
    INSERT INTO analyses (
      source, filename, input_text, categoria, prioridade,
      departamento, sentimento, resumo, pontos_chave,
      resposta_sugerida, raw_response
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const pontosStr = Array.isArray(result.pontos_chave) 
    ? JSON.stringify(result.pontos_chave) 
    : (result.pontos_chave || '[]');

  const rawStr = JSON.stringify(result);

  const info = stmt.run(
    source,
    filename,
    inputText,
    result.categoria || 'Outro',
    result.prioridade || 'Média',
    result.departamento || 'Geral',
    result.sentimento || 'Neutro',
    result.resumo || '',
    pontosStr,
    result.resposta_sugerida || '',
    rawStr
  );

  return info.lastInsertRowid;
}

/**
 * Retorna as últimas análises salvas
 */
export function getHistory(limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM analyses
    ORDER BY created_at DESC
    LIMIT ?
  `);
  const rows = stmt.all(limit);
  return rows.map(row => {
    let pontos_chave = [];
    try {
      pontos_chave = JSON.parse(row.pontos_chave || '[]');
    } catch {
      pontos_chave = [row.pontos_chave];
    }
    return {
      ...row,
      pontos_chave
    };
  });
}

/**
 * Retorna a contagem de análises realizadas hoje
 */
export function getTodayAnalysisCount() {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM analyses
      WHERE date(created_at) = date('now')
    `).get();
    return row ? Number(row.count) : 0;
  } catch (err) {
    console.error('Erro ao contar análises de hoje:', err);
    return 0;
  }
}

/**
 * Limpa o histórico
 */
export function clearHistory() {
  db.exec('DELETE FROM analyses');
}

