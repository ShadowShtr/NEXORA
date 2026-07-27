const STEP_LABELS = ['Cliente', 'Serviços', 'Data e horário', 'Confirmar'] as const;

export function WizardProgress({ stepIndex }: { stepIndex: number }) {
  const percent = ((stepIndex + 1) / STEP_LABELS.length) * 100;
  return (
    <div className="appointment-progress">
      <div className="appointment-progress-header">
        <span className="appointment-progress-label">
          Passo {stepIndex + 1} de {STEP_LABELS.length}
        </span>
        <span className="appointment-progress-step-name">{STEP_LABELS[stepIndex]}</span>
      </div>
      <div className="appointment-progress-track">
        <div className="appointment-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
