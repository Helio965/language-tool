# Auditoria complementar — IA, autorização e limites

**Estado:** revisão estática e correções propostas. A primeira rodada de CI passou com 221 testes de backend (15 de navegador excluídos); rodar novamente após cada alteração. Nenhum sistema pode ser considerado 100% seguro.

## Achados

| ID | Risco | Evidência | Mitigação |
| --- | --- | --- | --- |
| LLM-01 | Dados não confiáveis no prompt de sistema | `build_system_prompt` interpolava nome e perfil; `_request` anexava tarefas contendo fatos | Separação: apenas instruções estáticas e enums controlados no system; dados do aluno em mensagem de usuário |
| LLM-02 | Custos/saídas excessivos | `max_tokens=2048`, histórico com orçamento por caracteres; cota principalmente por IP | Teto configurável para tokens/total de caracteres e cota por conta |
| LLM-03 | Eco literal de instruções internas | JSON válido poderia conter partes do próprio system prompt | Detecção conservadora de trechos exatos e erro genérico. Não previne paráfrases |
| RATE-01 | Cotas IP insuficientes para usuários autenticados | Limits por IP e por minuto; memory storage padrão | Compartilhamento de janelas por conta, cota diária global por implantação e exigência de storage compartilhado na produção com Anthropic |
| HEAD-01 | HSTS ausente | `after_request` continha CSP e X-Frame mas não HSTS | HSTS em APP_ENV production e Permissions-Policy |
| RESET-01 | Verificação de token sem limite específico | `verify_reset` não tinha `reset_limit` | Limites de recuperação compartilhados |
| BOLA | Sem bypass confirmado na revisão | Recursos da conversa vinculados a usuário autenticado e exclusão baseada na sessão | Consulta com filtros combinados ID+user e regressão de exclusão em cascata A/B |

## Limites da revisão

Prompt injection e jailbreak são riscos probabilísticos; **nenhum filtro ou prompt garante** que instruções internas não serão parafraseadas. Não colocar credenciais nem segredos nos prompts. Os dados em texto de usuário devem ser tratados como não confiáveis. Testar em homologação a API LLM real, orçamento de tokens efetivo, custo financeiro efetivo (as cotas de requisições não são cotas monetárias), expiração/retenção, concorrência e infraestrutura. Controles no provedor (orçamento financeiro, limites de uso e alertas) são necessários para impedir gasto inesperado. Redis/TLS/proxy/deploy real e backend Express legado não foram validados.

Execute:
```bash
python -m pytest tests/security -q
python -m pytest -m "not browser" -q
```
