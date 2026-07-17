export const TOTAL_STEPS = 5;

export const STEP_TITLES: readonly string[] = [
  'Negócio e morada',
  'Horários de trabalho',
  'Serviços iniciais',
  'Regras recomendadas',
  'Publicar link e QR Code',
];

export function clampStep(step: number): number {
  return Math.min(Math.max(step, 1), TOTAL_STEPS);
}

export function nextStep(current: number): number {
  return clampStep(current + 1);
}

export function previousStep(current: number): number {
  return clampStep(current - 1);
}
