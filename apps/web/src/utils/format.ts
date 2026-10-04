/** Saudação conforme o horário local. */
export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Boa noite';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** 205 → "3h 25min"; 45 → "45 min". */
export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "hoje", "ontem", "há 3 dias", "em 2 dias" ou a data. */
export function relativeDay(iso: string, now = new Date()): string {
  const diff = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY_MS);
  if (diff === 0) return 'hoje';
  if (diff === -1) return 'ontem';
  if (diff === 1) return 'amanhã';
  if (diff < 0 && diff > -7) return `há ${-diff} dias`;
  if (diff > 0 && diff < 7) return `em ${diff} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
