# ALERTA DE SEGURANÇA DA INFORMAÇÃO E PRIVACIDADE (CSIRT)

**Protocolo:** SEC-INC-2026-8819  
**Nível de Severidade:** Crítico (P0)  
**Origem do Alerta:** Sistema Automatizado de Detecção de Intrusões (WAF / SIEM)  
**Data/Hora do Evento:** 18/11/2026 às 04:12:33 UTC  

---

## 1. Descrição do Incidente
Detectamos uma anomalia grave de autenticação envolvendo a conta com privilégios administrativos master (`admin@solucoesfinanceiras.com.br`). 

Foram registradas mais de 450 tentativas de login via força bruta utilizando dicionários de senhas vazadas provenientes de uma rede de IPs com geolocalização na Europa Oriental e Sudeste Asiático (IPs principais: `185.220.101.45`, `45.154.255.89`).

## 2. Indicadores de Comprometimento (IoC)
* Houve 1 sucesso de login autenticado sem desafio de segundo fator (MFA) às 04:15:02 UTC.
* Logo após a sessão ser iniciada, foram efetuadas requisições de download do banco de contatos e relatórios de faturamento corporativo (`GET /api/v1/export/customers.csv`).
* A chave de API master vinculada ao usuário foi utilizada para gerar 2 novos tokens com escopo de leitura total.

## 3. Ações Imediatas Solicitadas
1. **Revogação Emergencial:** Revogar imediatamente todos os tokens e sessões ativas do usuário `admin@solucoesfinanceiras.com.br`.
2. **Bloqueio de IP:** Aplicar bloqueio dos blocos de IP identificados no firewall perimetral (WAF).
3. **Auditoria Forense:** Isolar os logs dos últimos 7 dias para análise de escopo de vazamento de dados de clientes, conforme previsto no plano de resposta a incidentes da LGPD.
4. **Notificação ao DPO:** Comunicar o encarregado de proteção de dados para avaliação da necessidade de informe à ANPD.

Favor confirmar o acionamento do Comitê de Crise e Segurança em até 15 minutos.