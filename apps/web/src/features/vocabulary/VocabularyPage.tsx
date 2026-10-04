import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, Plus, RefreshCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { LEVEL_LABELS, PART_OF_SPEECH_LABELS, type VocabularyItemView } from '@english-ai/core';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Controls';
import { PageHeader, SectionTitle } from '../../components/Display';
import { Dialog, useToast } from '../../components/Overlay';
import { EmptyState, ErrorState, InlineAlert, Skeleton } from '../../components/States';
import { TextField } from '../../components/TextField';
import { useApi } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { relativeDay } from '../../utils/format';
import styles from './VocabularyPage.module.css';

type Filter = 'all' | 'due' | 'learned';

/** UC10 — Consultar vocabulário (RF08, RF17). */
export function VocabularyPage() {
  useDocumentTitle('Vocabulário');
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['vocabulary'], queryFn: () => api.getVocabulary() });
  const selectedId = params.get('palavra');

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'learning' | 'learned' }) => api.setWordStatus(id, status),
    onSuccess: async (item) => {
      toast(item.status === 'learned' ? `“${item.word}” marcada como aprendida.` : `“${item.word}” está na sua revisão.`);
      await queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      await queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });

  const all = useMemo(() => [...(query.data?.studied ?? []), ...(query.data?.suggestions ?? [])], [query.data]);
  const selected = all.find((item) => item.id === selectedId) ?? null;
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data?.studied ?? [])
      .filter((item) => (filter === 'due' ? item.due : filter === 'learned' ? item.status === 'learned' : true))
      .filter((item) => !term || item.word.toLowerCase().includes(term) || item.translation.toLowerCase().includes(term));
  }, [query.data, filter, search]);

  const open = (id: string) => setParams({ palavra: id });
  const close = () => setParams({});

  return (
    <div className="reveal">
      <PageHeader title="Vocabulário" subtitle="As palavras e expressões das suas aulas, com significado, exemplo e revisão." />
      {query.isPending && <Skeleton lines={5} height={56} />}
      {query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />}
      {query.data && (
        <>
          <div className={styles.counts}>
            <span>
              <strong>{query.data.counts.studied}</strong> estudadas
            </span>
            <span>
              <strong>{query.data.counts.due}</strong> para revisar
            </span>
            <span>
              <strong>{query.data.counts.learned}</strong> aprendidas
            </span>
          </div>

          {query.data.studied.length === 0 ? (
            <EmptyState
              title="Seu vocabulário começa na primeira aula"
              description="As palavras das aulas concluídas aparecerão aqui, prontas para revisar."
              action={
                <Button to="/aprender" variant="accent">
                  Ir para as aulas
                </Button>
              }
            />
          ) : (
            <>
              <div className={styles.toolbar}>
                <TextField
                  label="Buscar palavra"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ex.: kitchen ou cozinha"
                  end={<Search aria-hidden="true" className={styles.searchIcon} />}
                />
                <div className={styles.filters} role="group" aria-label="Filtrar palavras">
                  <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
                    Todas
                  </Chip>
                  <Chip selected={filter === 'due'} onClick={() => setFilter('due')}>
                    Para revisar
                  </Chip>
                  <Chip selected={filter === 'learned'} onClick={() => setFilter('learned')}>
                    Aprendidas
                  </Chip>
                </div>
              </div>
              {visible.length === 0 ? (
                <p className={styles.none} role="status">
                  Nenhuma palavra encontrada com esse filtro.
                </p>
              ) : (
                <ul className={styles.list} aria-label="Palavras estudadas">
                  {visible.map((item) => (
                    <WordRow key={item.id} item={item} onOpen={() => open(item.id)} />
                  ))}
                </ul>
              )}
              {query.data.counts.due > 0 && (
                <Button to="/revisao" variant="secondary" icon={<RefreshCcw aria-hidden="true" />} className={styles.reviewButton}>
                  Revisar {query.data.counts.due} {query.data.counts.due === 1 ? 'palavra' : 'palavras'}
                </Button>
              )}
            </>
          )}

          {query.data.suggestions.length > 0 && (
            <section aria-labelledby="suggestions-title" className={styles.suggestions}>
              <SectionTitle id="suggestions-title">Sugestões para o seu nível</SectionTitle>
              <ul className={styles.list}>
                {query.data.suggestions.map((item) => (
                  <WordRow key={item.id} item={item} onOpen={() => open(item.id)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Dialog
        open={Boolean(selected)}
        onClose={close}
        title={selected?.word ?? ''}
        footer={
          selected && (
            <>
              {selected.lessonId && (
                <Button to={`/aprender/aula/${selected.lessonId}`} variant="ghost" icon={<BookOpen aria-hidden="true" />}>
                  Ver aula
                </Button>
              )}
              {selected.status === 'learned' ? (
                <Button variant="secondary" onClick={() => setStatus.mutate({ id: selected.id, status: 'learning' })} loading={setStatus.isPending}>
                  Quero revisar de novo
                </Button>
              ) : selected.status === 'learning' ? (
                <Button icon={<Check aria-hidden="true" />} onClick={() => setStatus.mutate({ id: selected.id, status: 'learned' })} loading={setStatus.isPending}>
                  Já aprendi
                </Button>
              ) : (
                <Button icon={<Plus aria-hidden="true" />} onClick={() => setStatus.mutate({ id: selected.id, status: 'learning' })} loading={setStatus.isPending}>
                  Adicionar ao meu vocabulário
                </Button>
              )}
            </>
          )
        }
      >
        {selected && <WordDetails item={selected} />}
        {setStatus.isError && <InlineAlert>{errorMessage(setStatus.error)}</InlineAlert>}
      </Dialog>
    </div>
  );
}

function WordRow({ item, onOpen }: { item: VocabularyItemView; onOpen: () => void }) {
  return (
    <li>
      <button type="button" className={styles.row} onClick={onOpen}>
        <span className={styles.word} lang="en">
          {item.word}
        </span>
        <span className={styles.translation}>{item.translation}</span>
        <span className={styles.rowMeta}>
          {item.status === 'learned' && <Chip tone="success">Aprendida</Chip>}
          {item.due && <Chip tone="marker">Revisar</Chip>}
          {item.status === null && <Chip tone="learn">Nova</Chip>}
        </span>
      </button>
    </li>
  );
}

function WordDetails({ item }: { item: VocabularyItemView }) {
  return (
    <div className={styles.details}>
      <p className={styles.detailTranslation}>{item.translation}</p>
      <p className={styles.detailMeta}>
        {PART_OF_SPEECH_LABELS[item.partOfSpeech]} · nível {LEVEL_LABELS[item.level]} · {item.topic}
      </p>
      <div>
        <span className="caption">Significado</span>
        <p lang="en">{item.meaning}</p>
      </div>
      {item.examples.map((example) => (
        <div key={example.en} className={styles.example}>
          <span className="caption">Exemplo</span>
          <p lang="en">
            <strong>{example.en}</strong>
          </p>
          <p className="muted">{example.pt}</p>
        </div>
      ))}
      <p className={styles.detailMeta}>
        {item.status === null
          ? 'Ainda não está no seu vocabulário.'
          : item.status === 'learned'
            ? `Aprendida · revisada ${item.timesReviewed} ${item.timesReviewed === 1 ? 'vez' : 'vezes'}.`
            : item.nextReviewAt
              ? `Próxima revisão: ${relativeDay(item.nextReviewAt)}.`
              : ''}
        {item.lessonTitle && (
          <>
            {' '}
            Da aula <Link to={`/aprender/aula/${item.lessonId}`}>{item.lessonTitle}</Link>.
          </>
        )}
      </p>
    </div>
  );
}
