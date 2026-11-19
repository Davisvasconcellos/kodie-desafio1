# Dúvida Técnica: Rate Limiting e Renovação de Token OAuth2 na API v2

**Autor:** Felipe Mendonça (Tech Lead - Integrações)  
**Projeto:** Sincronizador de Pedidos CRM  
**Ambiente:** Staging / Sandbox  
**Data:** 18/11/2026  

---

## Contexto do Problema
Estamos finalizando a integração dos nossos sistemas de pedidos legados com a API REST de vocês utilizando a documentação oficial da versão 2.

Durante nossos testes de carga simulando 50 requisições simultâneas por segundo, notamos que o servidor retorna `HTTP 429 Too Many Requests` logo após a 30ª requisição consecutiva, com o cabeçalho `Retry-After: 60`.

### Nossas Dúvidas:
1. **Política de Rate Limit:** Qual é o limite padrão de requisições por minuto (`rpm`) para o plano Professional? É possível solicitar um aumento temporário dessa cota para rodarmos a migração de base histórica no próximo final de semana?
2. **Ciclo de Vida do Token:** O token JWT obtido via rota `/auth/token` expira a cada 3600 segundos (1 hora). Existe suporte a `refresh_token` automático sem necessidade de reenviar as credenciais de `client_secret` a cada ciclo?
3. **Webhook de Notificação:** Vocês possuem webhook para alertar quando o status de um pedido é alterado para "Finalizado", evitando a necessidade de realizarmos long polling a cada 10 segundos?

Se puderem nos disponibilizar uma coleção do Postman ou trecho de exemplo em Node.js / Python com a implementação recomendada de backoff exponencial, agradeceríamos muito.

Agradeço pela atenção da equipe de suporte aos desenvolvedores!
