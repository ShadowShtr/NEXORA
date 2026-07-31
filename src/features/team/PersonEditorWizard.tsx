'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { createTeamInvite } from '@/features/team/invite-actions';
import { setMemberActive, setProviderServices, updateMemberRole } from './member-actions';
import type { ServiceOption, TeamMemberListItem } from './queries';
import type { TenantRole } from '@/lib/auth/permissions';

const STEP_LABELS = ['Dados', 'Acesso', 'Serviços', 'Horários'] as const;

const ROLE_OPTIONS: { value: TenantRole; label: string }[] = [
  { value: 'owner', label: 'Dona' },
  { value: 'manager', label: 'Gestora' },
  { value: 'receptionist', label: 'Rececionista' },
  { value: 'provider', label: 'Prestadora' },
  { value: 'viewer', label: 'Visualizadora' },
];

function WizardProgress({ stepIndex }: { stepIndex: number }) {
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

// NEX-217: "Editor de pessoa — wizard de quatro passos: Dados, Acesso, Serviços,
// Horários." Duas formas de uso, com capacidades diferentes por natureza do sistema:
//
// - Nova pessoa (member === null): ainda não existe conta nem service_providers — só
//   um convite (tenant_invites, NEX-212) pode ser criado agora. Serviços/Horários
//   ficam como passos informativos: não há provider_id a que atribuir
//   provider_services/provider_business_hours antes de o convite ser aceite.
// - Pessoa existente (member !== null, já aceitou o convite): todos os 4 passos são
//   plenamente funcionais — mudar role/estado, e (se for prestadora) os serviços que
//   presta. Horários por prestador (provider_business_hours, NEX-213) ainda não tem
//   editor próprio nesta versão — o prestador usa o horário do negócio por omissão
//   (resolveProviderDayHours já trata este fallback), por isso o passo mostra essa
//   explicação em vez de um formulário que não existe ainda.
export function PersonEditorWizard({
  member,
  serviceOptions,
  initialProviderServiceIds,
  onClose,
}: {
  member: TeamMemberListItem | null;
  serviceOptions: ServiceOption[];
  initialProviderServiceIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState(member?.displayName ?? '');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TenantRole>(member?.role ?? 'receptionist');
  const [isProvider, setIsProvider] = useState(member?.isProvider ?? false);
  const [isActive, setIsActive] = useState(member?.isActive ?? true);
  const [serviceIds, setServiceIds] = useState<string[]>(initialProviderServiceIds);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ token: string; expiresAt: string } | null>(
    null,
  );

  function toggleService(serviceId: string) {
    setServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  async function handleCreateInvite() {
    setPending(true);
    setError(null);
    const result = await createTeamInvite({ name, email, role, isProvider });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setInviteResult(result.value);
  }

  async function handleSaveExistingMember() {
    if (!member) return;
    setPending(true);
    setError(null);

    if (role !== member.role) {
      const roleResult = await updateMemberRole({ userId: member.userId, role });
      if (!roleResult.ok) {
        setPending(false);
        setError(roleResult.error.message);
        return;
      }
    }

    if (isActive !== member.isActive) {
      const activeResult = await setMemberActive({ userId: member.userId, isActive });
      if (!activeResult.ok) {
        setPending(false);
        setError(activeResult.error.message);
        return;
      }
    }

    if (member.isProvider && member.providerId) {
      const servicesResult = await setProviderServices({
        providerId: member.providerId,
        serviceIds,
      });
      if (!servicesResult.ok) {
        setPending(false);
        setError(servicesResult.error.message);
        return;
      }
    }

    setPending(false);
    router.refresh();
    onClose();
  }

  const isEditMode = member !== null;
  const isLastStep = stepIndex === STEP_LABELS.length - 1;
  const canAdvanceFromStep0 = isEditMode || (name.trim().length >= 2 && email.trim().length > 3);

  return (
    <BottomSheet
      title={isEditMode ? member.displayName : 'Adicionar pessoa'}
      {...(!isEditMode ? { subtitle: 'Preencha os dados para gerar um convite.' } : {})}
      onClose={onClose}
    >
      <div className="team-wizard">
        <WizardProgress stepIndex={stepIndex} />

        {inviteResult ? (
          <div className="stack team-wizard-step">
            <p className="text-support">
              Convite criado. Partilhe este código manualmente com a pessoa (válido até{' '}
              {new Date(inviteResult.expiresAt).toLocaleDateString('pt-PT')}).
            </p>
            <p className="team-invite-token">{inviteResult.token}</p>
            <Button onClick={onClose}>Concluir</Button>
          </div>
        ) : (
          <>
            {stepIndex === 0 ? (
              <div className="stack team-wizard-step">
                <div className="form-field">
                  <label className="form-label" htmlFor="person-name">
                    Nome
                  </label>
                  <input
                    id="person-name"
                    className="form-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={isEditMode}
                    maxLength={120}
                    placeholder="Nome completo"
                  />
                </div>
                {!isEditMode ? (
                  <div className="form-field">
                    <label className="form-label" htmlFor="person-email">
                      E-mail
                    </label>
                    <input
                      id="person-email"
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      maxLength={255}
                      placeholder="nome@exemplo.pt"
                    />
                  </div>
                ) : (
                  <div className="form-field">
                    <span className="form-label">Estado</span>
                    <div className="service-editor-active-row">
                      <span>Conta ativa</span>
                      <button
                        type="button"
                        className="service-toggle"
                        data-active={isActive || undefined}
                        role="switch"
                        aria-checked={isActive}
                        aria-label="Conta ativa"
                        onClick={() => setIsActive((current) => !current)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {stepIndex === 1 ? (
              <div className="stack team-wizard-step">
                <div className="form-field">
                  <span className="form-label">Role</span>
                  <select
                    className="form-input"
                    value={role}
                    onChange={(event) => setRole(event.target.value as TenantRole)}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {!isEditMode ? (
                  <div className="form-field">
                    <span className="form-label">Prestadora de serviços</span>
                    <div className="service-editor-active-row">
                      <span>Esta pessoa presta serviços na agenda</span>
                      <button
                        type="button"
                        className="service-toggle"
                        data-active={isProvider || undefined}
                        role="switch"
                        aria-checked={isProvider}
                        aria-label="Prestadora de serviços"
                        onClick={() => setIsProvider((current) => !current)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {stepIndex === 2 ? (
              <div className="stack team-wizard-step">
                {!isEditMode ? (
                  <p className="text-support">
                    Poderá atribuir serviços a esta pessoa assim que aceitar o convite.
                  </p>
                ) : !member.isProvider ? (
                  <p className="text-support">Esta pessoa não é prestadora de serviços.</p>
                ) : serviceOptions.length === 0 ? (
                  <p className="text-support">Ainda não existem serviços ativos.</p>
                ) : (
                  <ul className="team-service-picker">
                    {serviceOptions.map((service) => (
                      <li key={service.id}>
                        <label className="team-service-picker-row">
                          <input
                            type="checkbox"
                            checked={serviceIds.includes(service.id)}
                            onChange={() => toggleService(service.id)}
                          />
                          {service.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {stepIndex === 3 ? (
              <div className="stack team-wizard-step">
                <p className="text-support">
                  {!isEditMode
                    ? 'O horário próprio pode ser configurado depois de a pessoa aceitar o convite. Até lá, segue o horário do negócio.'
                    : 'Esta pessoa segue o horário do negócio por predefinição. Um horário próprio por prestadora ficará disponível numa próxima atualização.'}
                </p>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="form-error">
                {error}
              </p>
            ) : null}

            <div className="form-sticky-footer team-wizard-footer">
              {stepIndex > 0 ? (
                <Button variant="secondary" onClick={() => setStepIndex((step) => step - 1)}>
                  Voltar
                </Button>
              ) : null}
              {!isLastStep ? (
                <Button
                  disabled={stepIndex === 0 && !canAdvanceFromStep0}
                  onClick={() => setStepIndex((step) => step + 1)}
                >
                  Seguinte
                </Button>
              ) : (
                <Button
                  disabled={pending}
                  onClick={isEditMode ? handleSaveExistingMember : handleCreateInvite}
                >
                  {pending ? 'A guardar…' : isEditMode ? 'Guardar' : 'Criar convite'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
