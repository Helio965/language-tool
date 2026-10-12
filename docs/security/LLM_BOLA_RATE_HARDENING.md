# Auditoria complementar — IA, autorização e limites

O trabalho continua no [PR #6](https://github.com/Helio965/language-tool/pull/6), preservando os 20 commits já existentes e as funcionalidades do English AI. O relatório completo está em [ADVANCED_SECURITY_AUDIT.md](ADVANCED_SECURITY_AUDIT.md), com escopo, evidências, correções, testes e limitações. Nenhum merge foi realizado.

A revisão inicial já separava dados não confiáveis das instruções privilegiadas e adicionava cotas por conta/globais, proteção de recuperação e cabeçalhos. A continuação validou esses controles com contas sintéticas e implementou correções adicionais:

- A cota paga é reservada somente diante de uma tentativa externa admitida; cache, catálogo, demo, revisão local, abertura autoral e erros locais mantêm seus fluxos sem consumir esse orçamento.
- Uma reserva curta por conversa impede chamadas simultâneas duplicadas durante seu prazo. O contador do provider simulado passou de duas chamadas para uma; a segunda requisição recebe `409 CONVERSATION_BUSY` e recupera a resposta persistida ao repetir a mesma chave após o commit.
- Respostas do provedor com Unicode inválido são rejeitadas antes da persistência. O SDK gerenciado usa destino oficial explícito, nenhuma tentativa automática e proteção contra registros verbosos de dados privados.
- Logs locais Werkzeug ocultam tokens de recuperação e query strings. Configuração efetiva de produção e cabeçalhos são revalidados; Redis compartilhado exige driver instalado e parâmetros compatíveis entre workers.

Não foi confirmado novo SQL Injection, BOLA/IDOR, bypass de sessão ou falha de cascata nos caminhos testados. A hipótese de consumo da cota paga por usuários anônimos foi refutada. Riscos condicionais de configuração e melhorias estão separados dos achados confirmados no relatório.

**Consolidação final:** **368 testes aprovados, 0 falhas e 0 ignorados**, incluindo 15 jornadas Chromium e seis testes com Redis real local. São 131 casos novos; commits publicados e CI do SHA da entrega são registrados no [PR #6](https://github.com/Helio965/language-tool/pull/6). Rodadas focadas observadas: 38 casos novos de SDK/LLM, 18 de reserva concorrente e 32 de autorização/sessões/logs. Seus totais não devem ser somados às suítes completas, que incluem esses casos.

Os testes usam SQLite temporário, contas fictícias e IA simulada, sem API paga ou dados reais. Provas locais não certificam Redis/TLS, SMTP, Gunicorn/proxy ou modelo real de produção. Prompt injection/jailbreak não são eliminados por filtros; cotas de requests não são orçamento financeiro. Crash, expiração de reserva ou falha do banco após resposta externa podem exigir nova tentativa com nova cobrança. Configure limites financeiros e alertas no provedor e confira a implantação conforme a seção 6 do relatório.

Para repetir as regressões de backend:

```bash
python -m pytest tests/security -q
python -m pytest -m "not browser" -q
```
