import { ASSISTANT_PERSONA } from '@english-ai/core';
import styles from '../settings/Settings.module.css';

/**
 * Transparência sobre dados (RNF05, Análise de requisitos §21, princípios da LGPD).
 * Texto informativo do protótipo acadêmico — não substitui uma política jurídica revisada.
 */
export function DataPolicy() {
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Dados coletados, finalidade e retenção</caption>
          <thead>
            <tr>
              <th scope="col">Dado</th>
              <th scope="col">Para quê</th>
              <th scope="col">Por quanto tempo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Nome, e-mail e senha (guardada só como hash)</th>
              <td data-label="Para quê">Criar a conta, entrar com segurança e chamar você pelo nome.</td>
              <td data-label="Por quanto tempo">Enquanto a conta existir.</td>
            </tr>
            <tr>
              <th scope="row">Perfil de aprendizagem (objetivo, nível, interesses)</th>
              <td data-label="Para quê">Personalizar aulas, assuntos de conversa e explicações.</td>
              <td data-label="Por quanto tempo">Enquanto a conta existir.</td>
            </tr>
            <tr>
              <th scope="row">Respostas, progresso, vocabulário e revisões</th>
              <td data-label="Para quê">Corrigir exercícios, mostrar sua evolução e sugerir revisões.</td>
              <td data-label="Por quanto tempo">Enquanto a conta existir.</td>
            </tr>
            <tr>
              <th scope="row">Mensagens das conversas</th>
              <td data-label="Para quê">Manter o contexto da conversa e permitir que você reveja o histórico.</td>
              <td data-label="Por quanto tempo">Até 90 dias (histórico ativo) ou até o fim da conversa (histórico desativado).</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>O que vai para a IA</h3>
      <ul className={styles.list}>
        <li>
          Apenas o necessário: seu primeiro nome, nível estimado, objetivo, interesses e as mensagens da conversa (ou a resposta do
          exercício).
        </li>
        <li>E-mail, senha e outros dados da conta nunca são enviados.</li>
        <li>Dados pessoais óbvios digitados nas mensagens (e-mail, telefone, CPF, cartão) são removidos antes de salvar e de enviar.</li>
        <li>
          {ASSISTANT_PERSONA.name} é uma IA: ela pode errar. As correções dos exercícios usam gabarito; as explicações da IA são apoio ao
          estudo.
        </li>
      </ul>
      <h3>Seus direitos</h3>
      <ul className={styles.list}>
        <li>Ver quais dados são coletados (esta página).</li>
        <li>Desativar o histórico de conversas e apagar conversas a qualquer momento.</li>
        <li>Excluir a conta e todos os dados associados.</li>
      </ul>
    </>
  );
}
