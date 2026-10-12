# Preparação comercial — English AI

## Estado e limite da entrega

Classificação: **ambiente de testes validado**, com base técnica de implantação
Linux documentada. A aplicação ainda não é uma implantação comercial validada.
As melhorias mantêm Flask/Jinja, SQLite, catálogo, contas e regras educacionais.
Nenhum serviço pago foi contratado e nenhum pagamento/assinatura foi criado.

## Funcionalidades e comportamento

| Área | Comportamento verificado / condição |
| --- | --- |
| Conta e sessão | Cadastro, login, logout, scrypt, cookies, CSRF e revogação de sessões |
| Recuperação | Tokens hashed, validade curta, uso único, outbox e SMTP controlado; entrega externa pendente |
| Aprender | Perfil, nivelamento opcional, aulas, cinco tipos de exercício, correções, resultados e retomada |
| Revisão/vocabulário/progresso | Persistência SQLite, revisão espaçada, estados vazios e evolução estimada |
| Conversar | Contexto, preferências, idempotência, feedback e origem demonstrativa/externa identificada |
| IA demonstrativa | Exclusiva de desenvolvimento/testes, roteiros locais identificados |
| IA real | Adaptador Anthropic com schemas/timeouts/erros testados em transporte controlado; chamada real pendente |
| Privacidade | Histórico opcional, retenção, exclusão; filtros parciais, sem garantia de anonimização completa |
| Lembretes | Desabilitados na interface e mudanças recusadas na API; valores antigos preservados |
| Produção | Gunicorn, Redis, HTTPS/Host/cookies e falhas por configuração validados localmente |

A landing mantém prévias educacionais e estatísticas demonstrativas com contexto
único. Números do catálogo vêm dos dados reais; progresso de aluno novo permanece
vazio. A apresentação profissional não esconde a demonstração ou a indisponibilidade.

## Dependências externas e credenciais

- **Anthropic:** chave do servidor, modelo acessível, orçamento e limites de uso.
  Validar respostas, qualidade pedagógica, latência, timeout, autenticação,
  indisponibilidade e consumo real. A ausência da chave retorna indisponibilidade,
  sem fallback para mock em produção.
- **SMTP:** host/porta/TLS, credenciais em par, remetente autorizado, domínio e
  autenticação de remetente (SPF/DKIM/DMARC conforme o fornecedor). Validar entrega,
  spam, falhas e links HTTPS reais. Solicitação recebida não significa entregue.
- **Operação:** host Linux, origem/domínio/certificado HTTPS, armazenamento SQLite
  persistente, Redis privado, gestão de segredos, backup externo e monitoramento.

Credenciais não estavam disponíveis neste ambiente. Não foram solicitadas em
chat nem embutidas em código. O proprietário deverá fornecê-las pelos mecanismos
seguros da hospedagem quando executar a validação externa.

## Pendências técnicas

1. E-mail precisa de fila durável com retries/observabilidade para sobreviver a
   reinícios e oferecer confiabilidade operacional. O executor atual é limitado
   e de melhor esforço, sem confirmação de entrega ao cliente.
2. Definir quotas/orçamento por conta e alertas de custos de IA: os limites atuais
   são por IP, sem contabilização comercial de consumo.
3. Executar testes de carga, concorrência e capacidade em infraestrutura alvo.
   SQLite continua adequado ao escopo documentado de um único host; múltiplos
   hosts ou escrita crescente exigem plano testado de PostgreSQL e rollback.
4. Definir e implementar requisitos de suporte, exportação de dados e eventual
   confirmação de e-mail se fizerem parte da oferta. Não foram anunciados como
   recursos entregues. Lembretes só devem ser ativados depois de envio verificável.
5. Realizar revisão de segurança independente/pentest e avaliação de acessibilidade
   com teclado, leitores de tela e aparelhos reais. Automação não comprova todos
   os critérios de WCAG nem elimina revisão humana.

## Pendências de infraestrutura

Aplicar [DEPLOYMENT.md](DEPLOYMENT.md) com os parâmetros reais, incluindo:

- migrations/seed explícitos, Gunicorn em loopback e proxy que sobrescreve headers;
- restrição de domínio e HTTPS, Redis compartilhado e storage persistente;
- cron/scheduler de retenção e backups, cópia externa privada e restauração ensaiada;
- logs sem tokens, corpos, cookies ou URLs privadas e alertas para falhas;
- plano de atendimento, recuperação e rollback aprovado pelo operador.

Os scripts e receita foram preparados, sem ativar scheduler/hospedagem pública.
Endpoints de readiness verificam configuração, sem comprovar entrega de SMTP ou
validade de API keys. A aplicação deve ser testada pela origem HTTPS real.

## Pendências jurídicas e decisões do proprietário

Os termos e informações de privacidade continuam **provisórios**. Antes da
oferta, definir responsável, identificação e contato, bases legais e finalidade,
fornecedores/transferência internacional, retenção de backups, atendimento a
pedidos de titulares e termos de acesso. Consultar responsável jurídico.
Não foram inventados CNPJ, endereço, razão social, preços, planos nem declarações
de conformidade integral com LGPD. Voz, ranking, administração, cobrança e
certificação não fazem parte desta implementação.

O proprietário precisa definir público, limites de catálogo, política de acesso,
suporte, capacidade, orçamento de IA, objetivos de recuperação/perda de dados e
critérios de comercialização. Aparência visual não substitui essas decisões.

## Critérios para avançar

A plataforma poderá ser avaliada como candidata à implantação após comprovar:
configuração completa, Anthropic/SMTP reais, fila de e-mail confiável, TLS/domínio,
backups/retention/restore agendados, capacidade observada, documentos legais
revisados, atendimento e orçamento. A categoria de implantação comercial validada
exige evidência dessas operações em produção e aceitação do proprietário.
