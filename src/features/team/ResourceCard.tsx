import { Armchair, ChevronRight, DoorOpen, Package, Wrench } from 'lucide-react';
import type { ResourceListItem } from './queries';

const TYPE_ICONS = {
  room: DoorOpen,
  equipment: Wrench,
  chair: Armchair,
  other: Package,
} as const;

const TYPE_LABELS: Record<ResourceListItem['type'], string> = {
  room: 'Sala',
  equipment: 'Equipamento',
  chair: 'Cadeira',
  other: 'Outro',
};

export function ResourceCard({
  resource,
  onSelect,
}: {
  resource: ResourceListItem;
  onSelect: () => void;
}) {
  const Icon = TYPE_ICONS[resource.type];
  return (
    <li className="team-resource-card-item">
      <button type="button" className="team-resource-card" onClick={onSelect}>
        <span className="team-resource-icon" aria-hidden="true">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="team-person-main-info">
          <span className="team-person-name-row">
            <span className="team-person-name">{resource.name}</span>
            {!resource.isActive ? (
              <span className="team-badge team-badge-inactive">Inativo</span>
            ) : null}
          </span>
          <span className="team-person-meta">
            {TYPE_LABELS[resource.type]}
            {resource.location ? ` · ${resource.location}` : ''} · {resource.serviceCount}{' '}
            serviço(s)
          </span>
        </span>
        <span className="team-person-chevron">
          <ChevronRight aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}
