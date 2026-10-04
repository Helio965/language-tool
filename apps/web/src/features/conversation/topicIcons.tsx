import { Briefcase, Cpu, GraduationCap, Hand, MessageCircle, Music, Plane, Sun, Utensils, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'message-circle': MessageCircle,
  hand: Hand,
  sun: Sun,
  utensils: Utensils,
  plane: Plane,
  briefcase: Briefcase,
  cpu: Cpu,
  music: Music,
  'graduation-cap': GraduationCap,
};

export function TopicIcon({ name }: { name: string }) {
  const Icon = ICONS[name] ?? MessageCircle;
  return <Icon aria-hidden="true" />;
}
