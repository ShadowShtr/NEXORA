// Shared "first letter of first two words, uppercase" fallback avatar — used everywhere
// a person/business has no uploaded photo yet (public landing cover avatar, resumo
// professional card) so the same name always produces the same initials.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
