'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ResourceCard } from './ResourceCard';
import { ResourceEditorSheet } from './ResourceEditorSheet';
import type { ResourceListItem, ServiceOption } from './queries';

export function ResourcesTabClient({
  resources,
  serviceOptions,
  resourceServiceIdsByResourceId,
}: {
  resources: ResourceListItem[];
  serviceOptions: ServiceOption[];
  resourceServiceIdsByResourceId: Record<string, string[]>;
}) {
  const [editingResource, setEditingResource] = useState<ResourceListItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  return (
    <div className="team-tab-panel">
      {resources.length === 0 ? (
        <div className="clients-empty-state">
          <p className="text-support">Ainda não existem salas ou equipamentos.</p>
          <Button onClick={() => setIsAddingNew(true)}>
            <Plus aria-hidden="true" size={18} />
            Adicionar sala ou equipamento
          </Button>
        </div>
      ) : (
        <ul className="team-person-cards-list">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onSelect={() => setEditingResource(resource)}
            />
          ))}
        </ul>
      )}

      {resources.length > 0 ? (
        <Button className="team-add-button" onClick={() => setIsAddingNew(true)}>
          <Plus aria-hidden="true" size={18} />
          Adicionar
        </Button>
      ) : null}

      {isAddingNew ? (
        <ResourceEditorSheet
          resource={null}
          serviceOptions={serviceOptions}
          initialResourceServiceIds={[]}
          onClose={() => setIsAddingNew(false)}
        />
      ) : null}

      {editingResource ? (
        <ResourceEditorSheet
          resource={editingResource}
          serviceOptions={serviceOptions}
          initialResourceServiceIds={resourceServiceIdsByResourceId[editingResource.id] ?? []}
          onClose={() => setEditingResource(null)}
        />
      ) : null}
    </div>
  );
}
