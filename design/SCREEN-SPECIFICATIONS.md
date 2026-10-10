# Especificação de telas — English AI

Este documento descreve as rotas e a composição da interface Flask/Jinja.
Aprendizagem e persistência são executadas em Python; JavaScript apresenta os
dados e envia ações à API. A especificação acadêmica anterior está preservada em
[docs/legacy/design/SCREEN-SPECIFICATIONS.md](../docs/legacy/design/SCREEN-SPECIFICATIONS.md).

As imagens em [screenshots/](./screenshots/) foram capturadas do protótipo
TypeScript anterior em modo demonstração: celular 390px, tablet 820px e desktop
1440px. São referências históricas; não comprovam execução, aparência ou
acessibilidade da versão Python. A evidência de validação atual está em
[MIGRATION-AUDIT.md](../docs/MIGRATION-AUDIT.md).

## 1. Rotas e arquivos atuais

As rotas estão em [blueprints/pages.py](../blueprints/pages.py). Todas usam
[base.html](../templates/base.html), [macros.html](../templates/macros.html),
[ui.css](../static/css/ui.css) e [python.css](../static/css/python.css).
[main.js](../static/js/main.js) inicia os módulos de interação.

| Tela | Rota | Template em `templates/` | Módulo em `static/js/` |
| --- | --- | --- | --- |
| Página pública | `/` | `landing.html` | `common.js` |
| Cadastro, login e recuperação | `/cadastro`, `/entrar`, `/recuperar-senha` | `auth/form.html` | `auth.js` |
| Redefinição | `/redefinir-senha/<token>` | `auth/form.html` | `auth.js` |
| Termos e privacidade | `/termos-e-privacidade` | `legal.html`, `data_policy.html` | `common.js` |
| Configuração e edição do perfil | `/configuracao`, `/perfil/editar` | `perfil/onboarding.html` | `onboarding.js` |
| Nivelamento e nova avaliação | `/nivelamento`, `/perfil/nivelamento` | `aprender/placement.html` | `placement.js` |
| Início, trilha, progresso e revisão | `/inicio`, `/aprender`, `/progresso`, `/revisao` | `feature.html` | `dashboard.js` |
| Aula | `/aprender/aula/<lesson_id>` | `aprender/lesson.html` | `learning.js` |
| Sessão de revisão | `/revisao/<review_id>` | `exercicios/review.html` | `learning.js` |
| Assuntos de conversa | `/conversar` | `feature.html` | `conversation.js` |
| Conversa e feedback final | `/conversar/<conversation_id>` | `conversar/chat.html` | `conversation.js` |
| Vocabulário | `/vocabulario` | `feature.html` | `vocabulary.js` |
| Perfil | `/perfil` | `perfil/profile.html` | `account.js` |
| Preferências | `/preferencias` | `configuracoes/preferences.html` | `account.js` |
| Privacidade e dados | `/privacidade` | `configuracoes/privacy.html`, `data_policy.html` | `account.js` |
| Erros de página | URL inexistente ou falha de página | `error.html` | `common.js` |

`/app` redireciona para `/inicio`. As páginas privadas direcionam contas novas à
configuração ou ao nivelamento antes de abrir o restante do app.

## 2. Público e conta

**Página pública:** marca, âncoras e acesso à conta; hero com contagens do
catálogo; problema; etapas do produto; Aprender; Conversar; IA; progresso;
personalização; segurança; chamada final e rodapé. As prévias têm o selo
Exemplo ilustrativo. O menu muda abaixo de 1100px. As âncoras atualizam o
endereço e focam o título; a rolagem respeita a preferência de movimento reduzido.
Uma conta autenticada segue para sua próxima etapa.

**Cadastro:** Nome, E-mail, Senha, confirmação e termos. Os requisitos reagem à
senha; o envio mostra estado pendente, mensagens por campo e foco no primeiro
campo informado pela API.

**Entrar:** E-mail, Senha e recuperação. O aviso de sessão expirada é distinto
do aviso de saída voluntária. Após autenticar, o app usa a etapa pendente ou um
destino interno válido solicitado anteriormente.

**Recuperar e redefinir senha:** recuperação mostra a resposta genérica da API e
o prazo do link; informa quando o envio precisa ser configurado. A tela atual
não oferece o link simulado da versão anterior. Redefinição verifica o token
antes de liberar o formulário e distingue link vencido, usado ou inválido.
Após sucesso, informa que as sessões anteriores foram encerradas.

## 3. Primeiro acesso

**Configuração:** objetivo; autoavaliação e experiência; interesses opcionais,
com até três áreas. Voltar preserva seleções no formulário aberto. Salvar envia
o perfil e segue ao nivelamento. Sair abre confirmação de logout. Na edição,
a saída cancela a edição e Salvar retorna ao perfil.

**Nivelamento:** introdução com estimativa de tempo, quatro a doze atividades e
opção de começar do zero. Perguntas chegam em etapas da API. O resultado mostra
nível, desempenho quando aplicável, comparação com a autoavaliação e ressalva
de que não é certificação. Primeiro acesso termina no Início; nova avaliação
pelo perfil termina no Perfil.

## 4. Estudo, conversa e evolução

**Início:** saudação, nível e objetivo; próxima aula ou aula em andamento;
revisões pendentes; modos; meta diária em barra e sequência; progresso, palavras
e última conversa quando há dados. O resumo ocupa coluna lateral em faixas
maiores. Sem aulas restantes, há ação para conversar.

**Aprender:** trilha por nível com aulas concluídas, em andamento, recomendadas
ou disponíveis. Aulas acima do nível têm orientação, sem bloqueio. O painel
leva à Revisão e ao Vocabulário.

**Aula:** objetivos → explicação → exemplos → vocabulário → exercícios → resumo.
Barra de progresso e sumário em faixas maiores; complementos de explicação e
exemplos solicitados à API. O resumo mostra resultado, tempo, aprendizados e
palavras, com ações para conversa, revisão ou próxima aula conforme a resposta.

**Conversar:** intensidade e histórico levam às preferências; assuntos
recomendados recebem Para você e os acima do nível recebem orientação.
Conversas recentes e aviso de histórico desativado dependem da conta.
O provedor demonstrativo recebe aviso de respostas simuladas.

**Conversa:** mensagens, tradução disponível, correções recolhidas com Por quê?,
avisos de privacidade e painel lateral. Enter envia; Shift+Enter insere linha.
Enquanto envia, mostra Lumi está preparando uma resposta…; falha devolve o
texto ao campo. Encerrar confirma a ação e apresenta o resumo no mesmo endereço,
com ajustes e aulas sugeridas. Sem histórico, informa a exclusão do conteúdo.

**Progresso:** vazio para quem ainda não começou. Com atividade, apresenta nível,
totais, últimos sete dias e revisões; quando disponíveis, também desempenho por
tema, erros recorrentes e aulas recentes. Os números vêm da API Python.

**Revisão:** fila vencida com motivo e ação; próximos itens com data. A sessão
compartilha o executor visual da aula. A API define atividades, nota e próxima
revisão.

**Vocabulário:** busca, filtros e lista; detalhes em diálogo com significado,
exemplos e ações de revisão/aprendizado. `?palavra=<id>` abre um item diretamente.

## 5. Perfil, preferências e dados

**Perfil:** dados da conta e aprendizagem, edição, nova avaliação e atalhos.
Logout mostra estado pendente, informa falhas e segue ao login após sucesso.
A sessão é validada no servidor; a interface também verifica retomada de página
e mudanças de sessão entre abas.

**Preferências:** idioma, intensidade, tamanho da resposta, meta, tradução,
histórico e lembretes. Alterações são salvas em fila após cada mudança, com
confirmação e restauração do campo se a API falhar. Lembretes são armazenados,
mas o MVP não os envia. A prévia de correção da referência anterior não está
presente na tela atual.

**Privacidade:** tabela de dados, uso pela IA e direitos; confirmação para apagar
histórico e exclusão da conta com senha. Erro na exclusão limpa a senha digitada.
Após sucesso, volta à página pública com aviso de exclusão.

## 6. Referências preservadas

A [especificação histórica](../docs/legacy/design/SCREEN-SPECIFICATIONS.md)
contém a numeração 01–21, os requisitos acadêmicos e o índice das capturas.
Para manter nomes de frames existentes no Figma, use essa numeração; a tabela
atual acima organiza as rotas sem renumerar o material histórico.

Exemplos preservados: [Início no celular](./screenshots/mobile-06-inicio.jpg),
[Aula no desktop](./screenshots/desktop-03-aula.jpg),
[Conversa no desktop](./screenshots/desktop-04-conversa.jpg) e
[Progresso no tablet](./screenshots/tablet-03-progresso.jpg).

Para obter evidência nova, execute a versão Python conforme o README e capture
os fluxos atuais nas mesmas larguras. Registre configuração, comando e
resultado; não atribua aos arquivos anteriores checks executados agora.
