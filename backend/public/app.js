// Resolução resiliente da URL do Backend
function resolveInitialBackendUrl() {
  if (typeof window === 'undefined' || !window.location.origin || !window.location.origin.startsWith('http')) {
    return 'http://localhost:3001';
  }
  const currentOrigin = window.location.origin;
  const stored = localStorage.getItem('backendUrl');

  // Se estamos em HTTPS ou em domínio público (não localhost) e o storage tinha localhost:3001,
  // limpa o storage para evitar Mixed Content e adota a origem atual do deploy
  if (stored && (window.location.protocol === 'https:' || !currentOrigin.includes('localhost')) && stored.includes('localhost')) {
    localStorage.removeItem('backendUrl');
    return currentOrigin;
  }

  return stored || currentOrigin;
}

const defaultBackendUrl = resolveInitialBackendUrl();

const state = {
  activeTab: 'text',
  backendUrl: defaultBackendUrl,
  n8nWebhookUrl: localStorage.getItem('n8nWebhookUrl') || 'https://n8n.dmedia.com.br/webhook/e7561c7e-44bb-4dcf-8a43-a8adca53ae32',
  geminiApiKey: localStorage.getItem('geminiApiKey') || '',
  routingMode: localStorage.getItem('routingMode') || 'n8n',
  selectedFile: null,
  extractedFileText: '',
  lastAnalysis: null,
  allowConfigEdits: false
};

// Exemplos rápidos para demonstração
const EXAMPLES = {
  financeiro: "Olá, estou recebendo cobranças em duplicidade na fatura deste mês da minha assinatura premium. Tentei contato pelo telefone mas não tive retorno. Preciso do estorno urgente do valor de R$ 199,00 cobrado a mais, senão vou cancelar a conta e acionar o Procon.",
  suporte: "Boa tarde equipe, após a atualização de ontem do sistema, o botão de exportar relatórios para CSV parou de responder. Aparece um erro '500 Internal Server Error' na tela de fechamento mensal. Todos os analistas da equipe estão parados sem conseguir fechar os relatórios de hoje.",
  solicitacao: "Gostaria de saber quais são os planos disponíveis para expandir o número de usuários na nossa organização para 50 membros e se vocês oferecem desconto para faturamento anual ou emissão de nota fiscal corporativa."
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initIcons();
  loadConfigurations();
  checkBackendHealth();
  setupEventListeners();
  updateCharCount();
});

// Gerenciamento de Tema (Light / Dark)
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

function applyTheme(theme) {
  const icon = document.getElementById('themeIcon');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    if (icon) {
      icon.setAttribute('data-lucide', 'sun');
    }
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    if (icon) {
      icon.setAttribute('data-lucide', 'moon');
    }
  }
  initIcons();
}

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Troca de Abas
function switchTab(tabId) {
  state.activeTab = tabId;

  // Atualizar classes dos botões
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white', 'shadow');
    btn.classList.add('text-slate-500', 'dark:text-slate-400');
  });

  const activeBtn = document.getElementById(`tabBtn-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
    activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow');
  }

  // Atualizar visibilidade do conteúdo
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });

  const activeContent = document.getElementById(`tabContent-${tabId}`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
  }

  if (tabId === 'history') {
    loadHistory();
  }

  initIcons();
}

// Preencher exemplo de texto
function fillExample(key) {
  const text = EXAMPLES[key];
  if (text) {
    document.getElementById('inputText').value = text;
    updateCharCount();
  }
}

// Atualizar contador de caracteres
function updateCharCount() {
  const val = document.getElementById('inputText').value || '';
  const countEl = document.getElementById('charCount');
  if (countEl) {
    countEl.innerText = `${val.length} caracteres`;
  }
}

// Listeners e Drag & Drop
function setupEventListeners() {
  const textarea = document.getElementById('inputText');
  if (textarea) {
    textarea.addEventListener('input', updateCharCount);
  }

  // Upload dropzone
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-950/20');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-950/20');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-950/20');
      if (e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }
}

// Extração de texto de arquivo (TXT, MD, CSV, JSON e PDF)
async function handleFileSelection(file) {
  if (!file) return;

  // Limite estrito de 500 KB por arquivo
  const MAX_FILE_SIZE = 500 * 1024; // 500 KB em bytes
  if (file.size > MAX_FILE_SIZE) {
    alert(`O arquivo "${file.name}" possui ${(file.size / 1024).toFixed(1)} KB e excede o limite máximo permitido de 500 KB.\n\nPor favor, envie um arquivo de até 500 KB.`);
    removeSelectedFile();
    return;
  }

  state.selectedFile = file;
  const fileNameEl = document.getElementById('fileName');
  const fileSizeEl = document.getElementById('fileSize');
  const previewContainer = document.getElementById('filePreviewContainer');
  const previewText = document.getElementById('fileExtractedPreview');
  const btnAnalyze = document.getElementById('btnAnalyzeFile');

  fileNameEl.innerText = file.name;
  fileSizeEl.innerText = `(${(file.size / 1024).toFixed(1)} KB)`;
  previewContainer.classList.remove('hidden');
  previewText.innerText = 'Processando e extraindo conteúdo do arquivo...';
  btnAnalyze.disabled = true;

  try {
    let extractedText = '';

    if (file.name.toLowerCase().endsWith('.pdf')) {
      // Extrai via PDF.js no navegador
      extractedText = await extractPdfText(file);
    } else {
      // Arquivos de texto padrão
      extractedText = await file.text();
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Não foi possível encontrar texto legível no arquivo.');
    }

    state.extractedFileText = extractedText;
    previewText.innerText = extractedText.length > 600 
      ? extractedText.substring(0, 600) + '... [conteúdo truncado para visualização]' 
      : extractedText;
    
    btnAnalyze.disabled = false;
  } catch (err) {
    previewText.innerText = `Erro na leitura: ${err.message}`;
    btnAnalyze.disabled = true;
  }

  initIcons();
}

// Extrator de texto de PDF no cliente
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += `--- Página ${i} ---\n` + strings.join(' ') + '\n\n';
  }

  return fullText.trim();
}

function removeSelectedFile() {
  state.selectedFile = null;
  state.extractedFileText = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('filePreviewContainer').classList.add('hidden');
  document.getElementById('btnAnalyzeFile').disabled = true;
}

// Controle de Status da LLM no Header
function updateLLMStatus(status = 'online', customText = null) {
  const dot = document.getElementById('llmStatusDot');
  const text = document.getElementById('llmStatusText');
  if (!dot || !text) return;

  const defaultModelText = 'Gemini 3.5 Lite • 15 RPM';

  if (status === 'online') {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    text.innerText = customText || defaultModelText;
  } else if (status === 'rate_limited') {
    dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    text.innerText = 'Gemini • 429 Limite';
  } else if (status === 'error') {
    dot.className = 'w-2 h-2 rounded-full bg-rose-500';
    text.innerText = customText || 'Gemini • Offline';
  }
}

// Checagem de status da conexão
async function checkBackendHealth() {
  try {
    const res = await fetch(`${state.backendUrl}/health`);
    if (res.ok) {
      updateLLMStatus('online');
    } else {
      updateLLMStatus('error');
    }
  } catch {
    updateLLMStatus('error');
  }
}

// Alternar modo de roteamento
function toggleRoutingMode() {
  const mode = document.querySelector('input[name="routingMode"]:checked')?.value || 'n8n';
  state.routingMode = mode;
  const n8nContainer = document.getElementById('cfgN8nContainer');
  if (n8nContainer) {
    if (mode === 'n8n') {
      n8nContainer.classList.remove('opacity-40');
    } else {
      n8nContainer.classList.add('opacity-40');
    }
  }
}

// Configurações
async function loadConfigurations() {
  document.getElementById('cfgBackendUrl').value = state.backendUrl;
  document.getElementById('cfgN8nUrl').value = state.n8nWebhookUrl;
  document.getElementById('cfgGeminiKey').value = state.geminiApiKey;

  const radio = document.querySelector(`input[name="routingMode"][value="${state.routingMode}"]`);
  if (radio) radio.checked = true;
  toggleRoutingMode();

  await checkConfigProtection();
}

async function checkConfigProtection() {
  // 1. Aplica bloqueio preventivamente (Segurança por Padrão)
  applyLockState(false);

  try {
    // Tenta primeiro endpoint relativo (sempre funciona no mesmo host, sem risco de CORS ou Mixed Content)
    let res = null;
    try {
      res = await fetch('/api/config-status');
    } catch {
      // Se relativo falhar (ex: rodando via porta separada local), tenta com state.backendUrl
      res = await fetch(`${state.backendUrl}/api/config-status`);
    }

    if (res && res.ok) {
      const data = await res.json();
      state.allowConfigEdits = (data.allowConfigEdits === true);

      if (data.defaultWebhookUrl && !state.allowConfigEdits) {
        state.n8nWebhookUrl = data.defaultWebhookUrl;
        const n8nInput = document.getElementById('cfgN8nUrl');
        if (n8nInput) n8nInput.value = data.defaultWebhookUrl;
      }

      applyLockState(state.allowConfigEdits);
    } else {
      applyLockState(false);
    }
  } catch (err) {
    console.warn('Não foi possível verificar status de proteção:', err);
    applyLockState(false);
  }

  initIcons();
}

function applyLockState(allowEdits) {
  const geminiInput = document.getElementById('cfgGeminiKey');
  const n8nInput = document.getElementById('cfgN8nUrl');
  const backendInput = document.getElementById('cfgBackendUrl');
  const lockBanner = document.getElementById('cfgLockBanner');
  const badge = document.getElementById('cfgProtectionBadge');
  const geminiLockStatus = document.getElementById('geminiLockStatus');
  const webhookLockStatus = document.getElementById('webhookLockStatus');
  const backendLockStatus = document.getElementById('backendLockStatus');

  if (!allowEdits) {
    // MODO SOMENTE LEITURA (BLOQUEADO)
    if (geminiInput) {
      geminiInput.readOnly = true;
      geminiInput.value = '';
      geminiInput.placeholder = '🔒 Chave gerenciada no servidor (.env)';
      geminiInput.classList.add('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
      geminiInput.classList.remove('bg-slate-50', 'dark:bg-slate-950', 'text-slate-800', 'dark:text-slate-200');
    }
    if (n8nInput) {
      n8nInput.readOnly = true;
      n8nInput.classList.add('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
      n8nInput.classList.remove('bg-white', 'dark:bg-slate-900', 'text-slate-800', 'dark:text-slate-200');
    }
    if (backendInput) {
      backendInput.readOnly = true;
      backendInput.classList.add('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
      backendInput.classList.remove('bg-slate-50', 'dark:bg-slate-950', 'text-slate-800', 'dark:text-slate-200');
    }
    if (lockBanner) lockBanner.classList.remove('hidden');
    if (badge) badge.classList.remove('hidden');
    if (geminiLockStatus) geminiLockStatus.innerHTML = '<span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"><i data-lucide="lock" class="w-3 h-3"></i> Somente Leitura</span>';
    if (webhookLockStatus) webhookLockStatus.innerHTML = '<span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"><i data-lucide="lock" class="w-3 h-3"></i> Somente Leitura</span>';
    if (backendLockStatus) backendLockStatus.innerHTML = '<span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"><i data-lucide="lock" class="w-3 h-3"></i> Somente Leitura</span>';
  } else {
    // MODO EDITÁVEL (ALLOW_CONFIG_EDITS=true)
    if (geminiInput) {
      geminiInput.readOnly = false;
      geminiInput.placeholder = 'AIzaSy... ou AQ.Ab8...';
      geminiInput.classList.remove('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
      geminiInput.classList.add('bg-slate-50', 'dark:bg-slate-950', 'text-slate-800', 'dark:text-slate-200');
    }
    if (n8nInput) {
      n8nInput.readOnly = false;
      n8nInput.classList.remove('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
      n8nInput.classList.add('bg-white', 'dark:bg-slate-900', 'text-slate-800', 'dark:text-slate-200');
    }
    if (backendInput) {
      backendInput.readOnly = false;
      backendInput.classList.remove('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
      backendInput.classList.add('bg-slate-50', 'dark:bg-slate-950', 'text-slate-800', 'dark:text-slate-200');
    }
    if (lockBanner) lockBanner.classList.add('hidden');
    if (badge) badge.classList.add('hidden');
    if (geminiLockStatus) geminiLockStatus.innerHTML = '<span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><i data-lucide="unlock" class="w-3 h-3"></i> Editável</span>';
    if (webhookLockStatus) webhookLockStatus.innerHTML = '<span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><i data-lucide="unlock" class="w-3 h-3"></i> Editável</span>';
    if (backendLockStatus) backendLockStatus.innerHTML = '<span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><i data-lucide="unlock" class="w-3 h-3"></i> Editável</span>';
  }
}

function saveConfigurations() {
  const newRoutingMode = document.querySelector('input[name="routingMode"]:checked')?.value || 'n8n';
  state.routingMode = newRoutingMode;
  localStorage.setItem('routingMode', state.routingMode);

  // Apenas salva backendUrl, n8nWebhookUrl e geminiApiKey no localStorage se a edição estiver liberada
  if (state.allowConfigEdits) {
    const newBackendUrl = document.getElementById('cfgBackendUrl').value.trim();
    const newN8nUrl = document.getElementById('cfgN8nUrl').value.trim();
    const newGeminiKey = document.getElementById('cfgGeminiKey').value.trim();
    if (newBackendUrl) {
      state.backendUrl = newBackendUrl;
      localStorage.setItem('backendUrl', state.backendUrl);
    }
    if (newN8nUrl) {
      state.n8nWebhookUrl = newN8nUrl;
      localStorage.setItem('n8nWebhookUrl', state.n8nWebhookUrl);
    }
    if (newGeminiKey) {
      state.geminiApiKey = newGeminiKey;
      localStorage.setItem('geminiApiKey', state.geminiApiKey);
    }
  }

  checkBackendHealth();
  alert('Configurações salvas com sucesso!');
  switchTab('text');
}

// Teste de Diagnóstico do Webhook n8n
async function testN8nWebhook() {
  const urlInput = document.getElementById('cfgN8nUrl');
  const targetUrl = urlInput ? urlInput.value.trim() : state.n8nWebhookUrl;

  const btn = document.getElementById('btnTestWebhook');
  const resultBox = document.getElementById('webhookTestResult');
  const titleEl = document.getElementById('webhookStatusTitle');
  const latencyEl = document.getElementById('webhookLatency');
  const msgEl = document.getElementById('webhookStatusMessage');
  const bodyEl = document.getElementById('webhookResponseBody');

  if (!targetUrl) {
    alert('Por favor, informe a URL do Webhook do n8n para testar.');
    return;
  }

  // Estado de loading
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Enviando teste ao n8n...</span>`;
  resultBox.classList.remove('hidden');
  resultBox.className = 'text-xs p-3 rounded-lg border font-mono transition-all bg-slate-900 border-slate-700 text-slate-300';
  titleEl.innerText = 'Testando conexão...';
  latencyEl.innerText = 'Aguardando...';
  msgEl.innerText = `Disparando requisição POST para: ${targetUrl}`;
  bodyEl.innerText = 'Enviando payload de teste...';
  initIcons();

  const startTime = performance.now();

  try {
    const payload = {
      text: "Mensagem de teste de diagnóstico disparada a partir do Frontend.",
      source: "diagnostico_frontend",
      filename: null,
      apiKey: state.geminiApiKey || undefined,
      timestamp: new Date().toISOString()
    };

    // Envia através do backend relay para evitar bloqueio de CORS do navegador
    const res = await fetch(`${state.backendUrl}/api/webhook-relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhookUrl: targetUrl,
        payload
      })
    });

    const elapsed = Math.round(performance.now() - startTime);
    latencyEl.innerText = `${elapsed} ms`;

    const relayJson = await res.json();
    const statusCode = relayJson.status || res.status;
    const responseData = relayJson.data || relayJson;

    if (res.ok && relayJson.success) {
      resultBox.className = 'text-xs p-3 rounded-lg border font-mono transition-all bg-emerald-950/30 border-emerald-800 text-emerald-300';
      titleEl.innerText = `✅ Sucesso HTTP ${statusCode}`;
      msgEl.innerText = 'O n8n recebeu a requisição e retornou uma resposta válida!';
      bodyEl.innerText = typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData;
    } else if (statusCode === 404) {
      resultBox.className = 'text-xs p-3 rounded-lg border font-mono transition-all bg-amber-950/30 border-amber-800 text-amber-300';
      titleEl.innerText = `⚠️ Atenção HTTP 404 Not Found`;
      msgEl.innerText = 'O n8n respondeu, mas informou que este Webhook não está ativo ou não foi registrado. Ative o fluxo no n8n (toggle Active) ou clique em "Listen for test event".';
      bodyEl.innerText = typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData;
    } else {
      resultBox.className = 'text-xs p-3 rounded-lg border font-mono transition-all bg-rose-950/30 border-rose-800 text-rose-300';
      titleEl.innerText = `❌ Resposta HTTP ${statusCode}`;
      msgEl.innerText = relayJson.error || 'O n8n recebeu o chamado, mas ocorreu um erro no processamento do fluxo.';
      bodyEl.innerText = typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData;
    }
  } catch (err) {
    const elapsed = Math.round(performance.now() - startTime);
    latencyEl.innerText = `${elapsed} ms`;
    resultBox.className = 'text-xs p-3 rounded-lg border font-mono transition-all bg-rose-950/30 border-rose-800 text-rose-300';
    titleEl.innerText = '❌ Falha de Rede ou CORS';
    msgEl.innerText = `Não foi possível alcançar o n8n (${err.message}). Pode ser bloqueio de CORS no navegador ou URL incorreta.`;
    bodyEl.innerText = String(err.stack || err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Disparar Teste para o Webhook</span>`;
    initIcons();
  }
}

// Processar Análise (Texto ou Arquivo)
async function handleAnalyze(type) {
  let textToAnalyze = '';
  let filename = null;

  if (type === 'text') {
    textToAnalyze = document.getElementById('inputText').value.trim();
    if (!textToAnalyze) {
      alert('Por favor, digite ou cole um texto para ser analisado.');
      return;
    }
  } else if (type === 'file') {
    textToAnalyze = state.extractedFileText.trim();
    filename = state.selectedFile ? state.selectedFile.name : 'arquivo';
    if (!textToAnalyze) {
      alert('Nenhum texto encontrado no arquivo selecionado.');
      return;
    }
  }

  setLoading(true, { type, filename });

  try {
    const payload = {
      text: textToAnalyze,
      source: type,
      filename: filename,
      apiKey: state.geminiApiKey || undefined
    };

    let responseData = null;

    if (state.routingMode === 'n8n') {
      // Envio via relay seguro no backend para evitar bloqueio de CORS do navegador
      const res = await fetch(`${state.backendUrl}/api/webhook-relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: state.n8nWebhookUrl,
          payload
        })
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        const errorDetail = resJson.error || resJson.data?.message || `Erro HTTP ${res.status}`;
        throw new Error(`Falha no n8n: ${errorDetail}`);
      }

      const relayData = resJson.data;
      responseData = relayData.data || relayData;
    } else {
      // Envio direto para o Express
      const headers = { 'Content-Type': 'application/json' };
      if (state.geminiApiKey) {
        headers['x-api-key'] = state.geminiApiKey;
      }

      const res = await fetch(`${state.backendUrl}/api/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const resJson = await res.json();
      if (!resJson.success) {
        throw new Error(resJson.error || 'Erro ao processar análise no backend.');
      }
      responseData = resJson.data;
    }

    renderResult(responseData);
    updateLLMStatus('online');
  } catch (err) {
    if (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.toLowerCase().includes('rate limit'))) {
      updateLLMStatus('rate_limited');
    }
    alert(`Falha no processamento: ${err.message}`);
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// Controle de Loading e Overlay em Tela Cheia
let loadingTimerInterval = null;
let loadingStartTime = 0;

function setLoading(isLoading, context = {}) {
  const overlay = document.getElementById('loadingOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySubtitle = document.getElementById('overlaySubtitle');
  const overlayStepText = document.getElementById('overlayStepText');
  const overlayTimer = document.getElementById('overlayTimer');
  const badge = document.getElementById('processingBadge');
  const btnText = document.getElementById('btnAnalyzeText');
  const btnFile = document.getElementById('btnAnalyzeFile');

  if (isLoading) {
    if (badge) badge.classList.remove('hidden');
    if (btnText) btnText.disabled = true;
    if (btnFile) btnFile.disabled = true;

    if (overlay) {
      overlay.classList.remove('hidden');

      if (context.type === 'file') {
        if (overlayTitle) overlayTitle.innerText = 'Processando Documento com IA';
        if (overlaySubtitle) overlaySubtitle.innerText = `Analisando "${context.filename || 'arquivo'}" via esteira inteligente...`;
      } else {
        if (overlayTitle) overlayTitle.innerText = 'Processando Triagem Inteligente';
        if (overlaySubtitle) overlaySubtitle.innerText = 'Classificando mensagem, gerando resumo e calculando SLA...';
      }

      if (overlayStepText) {
        overlayStepText.innerText = state.routingMode === 'n8n' 
          ? 'Orquestrando via n8n (Webhook + IA + SLA)...' 
          : 'Consultando API Google Gemini (Direto)...';
      }

      // Cronômetro dinâmico de latência
      loadingStartTime = performance.now();
      if (overlayTimer) overlayTimer.innerText = '0.0s';
      if (loadingTimerInterval) clearInterval(loadingTimerInterval);
      loadingTimerInterval = setInterval(() => {
        const elapsed = ((performance.now() - loadingStartTime) / 1000).toFixed(1);
        if (overlayTimer) overlayTimer.innerText = `${elapsed}s`;
      }, 100);
    }
  } else {
    if (badge) badge.classList.add('hidden');
    if (btnText) btnText.disabled = false;
    if (btnFile) btnFile.disabled = false;

    if (loadingTimerInterval) {
      clearInterval(loadingTimerInterval);
      loadingTimerInterval = null;
    }

    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  initIcons();
}

// Renderiza o resultado da IA na tela
function renderResult(data) {
  state.lastAnalysis = data;

  document.getElementById('emptyResult').classList.add('hidden');
  document.getElementById('resultContent').classList.remove('hidden');

  // Badges
  const catEl = document.getElementById('resCategoria');
  const prioEl = document.getElementById('resPrioridade');
  const depEl = document.getElementById('resDepartamento');
  const sentEl = document.getElementById('resSentimento');

  catEl.innerText = data.categoria || 'Não classificado';
  prioEl.innerText = data.prioridade || 'Média';
  depEl.innerText = data.departamento || 'Geral';
  sentEl.innerText = data.sentimento || 'Neutro';

  // Cores dinâmicas de prioridade
  prioEl.className = 'font-semibold text-sm';
  const prio = (data.prioridade || '').toLowerCase();
  if (prio.includes('crítica') || prio.includes('critica')) {
    prioEl.classList.add('text-rose-600', 'dark:text-rose-400');
  } else if (prio.includes('alta')) {
    prioEl.classList.add('text-orange-600', 'dark:text-orange-400');
  } else if (prio.includes('média') || prio.includes('media')) {
    prioEl.classList.add('text-amber-600', 'dark:text-amber-400');
  } else {
    prioEl.classList.add('text-emerald-600', 'dark:text-emerald-400');
  }

  // Resumo
  document.getElementById('resResumo').innerText = data.resumo || 'Sem resumo fornecido.';

  // Pontos-chave
  const pontosUl = document.getElementById('resPontosChave');
  pontosUl.innerHTML = '';
  const pontos = Array.isArray(data.pontos_chave) ? data.pontos_chave : [data.pontos_chave];
  pontos.forEach(p => {
    if (p) {
      const li = document.createElement('li');
      li.innerText = p;
      pontosUl.appendChild(li);
    }
  });

  // Ação Recomendada
  document.getElementById('resAcao').innerText = data.acao_recomendada || 'Verificar detalhes da solicitação.';

  // Resposta Sugerida
  document.getElementById('resResposta').innerText = `"${data.resposta_sugerida || 'Agradecemos o contato. Estamos analisando sua solicitação.'}"`;

  // Payload JSON Bruto
  document.getElementById('rawJsonContainer').innerText = JSON.stringify(data, null, 2);

  initIcons();
}

// Alternar visualização JSON
function toggleRawJson() {
  const container = document.getElementById('rawJsonContainer');
  const label = document.getElementById('rawJsonToggleText');
  if (container.classList.contains('hidden')) {
    container.classList.remove('hidden');
    label.innerText = 'Ocultar Payload JSON Bruto';
  } else {
    container.classList.add('hidden');
    label.innerText = 'Ver Payload JSON Bruto';
  }
}

// Copiar resposta sugerida
function copySuggestedResponse() {
  const text = document.getElementById('resResposta').innerText.replace(/^"|"$/g, '');
  navigator.clipboard.writeText(text).then(() => {
    alert('Resposta sugerida copiada para a área de transferência!');
  });
}

// Carregar histórico do SQLite
async function loadHistory() {
  const listEl = document.getElementById('historyList');
  listEl.innerHTML = '<p class="text-xs text-slate-400 dark:text-slate-500 text-center py-6">Consultando banco de dados...</p>';

  try {
    const res = await fetch(`${state.backendUrl}/api/history`);
    const json = await res.json();

    if (!json.success || !json.history || json.history.length === 0) {
      listEl.innerHTML = '<p class="text-xs text-slate-400 dark:text-slate-500 text-center py-6">Nenhum registro encontrado no histórico.</p>';
      return;
    }

    listEl.innerHTML = '';
    json.history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl hover:border-indigo-400 dark:hover:border-slate-700 transition cursor-pointer flex flex-col space-y-1 shadow-xs';
      
      const date = new Date(item.created_at).toLocaleString('pt-BR');
      
      card.innerHTML = `
        <div class="flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <span class="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">${item.categoria || 'Geral'}</span>
            <span class="text-slate-500 dark:text-slate-400">• ${item.departamento || 'Setor'}</span>
          </div>
          <span class="text-slate-400 dark:text-slate-500 text-[10px]">${date}</span>
        </div>
        <p class="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">${item.resumo || item.input_text}</p>
      `;

      card.addEventListener('click', () => {
        let raw = null;
        try {
          raw = JSON.parse(item.raw_response);
        } catch {
          raw = {
            categoria: item.categoria,
            prioridade: item.prioridade,
            departamento: item.departamento,
            sentimento: item.sentimento,
            resumo: item.resumo,
            pontos_chave: item.pontos_chave,
            resposta_sugerida: item.resposta_sugerida
          };
        }
        renderResult(raw);
      });

      listEl.appendChild(card);
    });
  } catch (err) {
    listEl.innerHTML = `<p class="text-xs text-rose-500 text-center py-6">Erro ao carregar histórico: ${err.message}</p>`;
  }
}

// Limpar histórico
async function handleClearHistory() {
  if (!confirm('Deseja realmente limpar todo o histórico de análises do banco?')) return;

  try {
    const res = await fetch(`${state.backendUrl}/api/history`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      loadHistory();
    }
  } catch (err) {
    alert(`Erro ao limpar: ${err.message}`);
  }
}
