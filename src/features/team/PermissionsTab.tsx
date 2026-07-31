import { hasPermission, type Permission, type TenantRole } from '@/lib/auth/permissions';

const ROLES: readonly TenantRole[] = ['owner', 'manager', 'receptionist', 'provider', 'viewer'];

const ROLE_LABELS: Record<TenantRole, string> = {
  owner: 'Dona',
  manager: 'Gestora',
  receptionist: 'Rececionista',
  provider: 'Prestadora',
  viewer: 'Visualizadora',
};

const PERMISSION_LABELS: Record<Permission, string> = {
  view_agenda: 'Ver agenda',
  create_appointment: 'Criar marcação',
  edit_appointment: 'Editar marcação',
  complete_appointment: 'Concluir marcação',
  view_amounts: 'Ver valores',
  manage_clients: 'Gerir clientes',
  view_private_notes: 'Ver notas privadas',
  view_sensitive_records: 'Ver registos sensíveis',
  manage_services: 'Gerir serviços',
  manage_team: 'Gerir equipa',
  manage_stock: 'Gerir stock',
  view_reports: 'Ver relatórios',
  export_data: 'Exportar dados',
  change_settings: 'Alterar definições',
};

const PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

// NEX-217 (Permissões): tabela só de leitura — a matriz é fixa em código
// (src/lib/auth/permissions.ts, NEX-211) e documentada em docs/PERMISSION_MATRIX.md;
// esta tab existe para a dona perceber o que cada role pode fazer, não para editar a
// matriz (mudar quem pode o quê exige uma decisão de produto e ADR, não um formulário).
export function PermissionsTab() {
  return (
    <div className="team-permissions-table-wrapper">
      <table className="team-permissions-table">
        <thead>
          <tr>
            <th scope="col">Permissão</th>
            {ROLES.map((role) => (
              <th scope="col" key={role}>
                {ROLE_LABELS[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((permission) => (
            <tr key={permission}>
              <th scope="row">{PERMISSION_LABELS[permission]}</th>
              {ROLES.map((role) => (
                <td key={role}>
                  {hasPermission(role, permission) ? (
                    <span aria-label="Permitido">✓</span>
                  ) : (
                    <span aria-hidden="true">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-support">
        A permissão de agenda de uma prestadora aplica-se apenas às suas próprias marcações, não à
        agenda inteira.
      </p>
    </div>
  );
}
