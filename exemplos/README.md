# 📁 Arquivos de Exemplo para Teste de Upload

Esta pasta contém **10 arquivos representativos** em diferentes formatos (`.txt`, `.md`, `.csv`, `.json`), criados para permitir que avaliadores e usuários testem a esteira de triagem inteligente via **upload de arquivos (limite 500 KB)**.

> ⚠️ **Aviso de Dados Fictícios:**  
> Todos os nomes, empresas, CNPJs, CPFs, e-mails e transações contidos nestes arquivos são **100% fictícios**, gerados unicamente para fins didáticos e demonstração das capacidades de processamento de linguagem natural da solução.

---

## 📋 Catálogo de Cenários e Arquivos

| # | Arquivo | Formato | Cenário Corporativo | Categoria Esperada | Gravidade / SLA |
|---|---|---|---|---|---|
| **1** | `01-email-cobranca-duplicada.txt` | `.txt` | E-mail formal de cliente contestando cobrança duplicada no cartão sob ameaça de Procon | **Financeiro** | Crítica (30 min) |
| **2** | `02-chamado-falha-critica-sistema.txt` | `.txt` | Abertura de chamado de emergência por pane em caixas de supermercado na emissão de NF-e | **Suporte Técnico** | Crítica (30 min) |
| **3** | `03-proposta-expansao-comercial.txt` | `.txt` | Solicitação de cotação corporativa para upgrade para 150 licenças Enterprise | **Comercial** | Média (4 horas) |
| **4** | `04-suporte-integracao-api.md` | `.md` | Dúvida de arquiteto de software sobre rate limit (HTTP 429) e renovação de token OAuth2 | **Suporte Técnico** | Baixa / Média |
| **5** | `05-notificacao-cancelamento-contrato.txt` | `.txt` | Notificação formal de rescisão de contrato por instabilidade crônica do sistema | **Comercial / Jurídico** | Alta (30 min) |
| **6** | `06-transcricao-chat-ao-vivo.txt` | `.txt` | Transcrição de chat de atendimento ao vivo com cliente com dificuldades para resetar senha | **Suporte Técnico** | Média (4 horas) |
| **7** | `07-relatorio-feedbacks-clientes.csv` | `.csv` | Planilha exportada com comentários de NPS, sugestões de features e críticas operacionais | **Operações / Produto** | Baixa / Média |
| **8** | `08-alerta-seguranca-acesso-suspeito.md` | `.md` | Alerta técnico de intrusão do WAF/SIEM com ataque de força bruta contra conta master | **Segurança / TI** | Crítica (30 min) |
| **9** | `09-elogio-reconhecimento-suporte.txt` | `.txt` | Carta calorosa de cliente elogiando analistas de suporte pela dedicação na migração | **Elogio / Relacionamento** | Baixa (4 horas) |
| **10** | `10-webhook-estorno-gateway.json` | `.json` | Carga útil em JSON de gateway de pagamento notificando disputa de chargeback com prazo | **Financeiro** | Alta (30 min) |

---

## 🚀 Como Testar na Aplicação:

1. Acesse o sistema em: [https://desafio1.dmedia.com.br](https://desafio1.dmedia.com.br) ou `http://localhost:3001`.
2. Clique na aba **"Upload de Arquivo"**.
3. Arraste qualquer um dos arquivos desta pasta ou clique para selecionar.
4. Veja o preview instantâneo do texto extraído (com validação do limite de 500 KB).
5. Clique em **"Processar Triagem do Arquivo"** e veja a IA classificar, resumir e calcular o SLA dinâmico!
