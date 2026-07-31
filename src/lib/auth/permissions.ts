// NEX-211: single source of truth for role-based authorization within a tenant —
// docs/PERMISSION_MATRIX.md documents this table in prose; keep the two in sync.
// RLS (current_tenant_id()) is the final guarantee that a member can only ever touch
// their *own* tenant's rows; this is the layer above that, for "which members of the
// same tenant can do what" — something the current RLS policies don't distinguish at
// all (any authenticated member of a tenant passes the same policy regardless of role).
//
// `admin` (public.user_role) is a legacy value never assigned to anyone
// (docs/adr/ADR-011-tenant-members-extends-profiles.md) — deliberately absent here.
export type TenantRole = 'owner' | 'manager' | 'receptionist' | 'provider' | 'viewer';

export type Permission =
  | 'view_agenda'
  | 'create_appointment'
  | 'edit_appointment'
  | 'complete_appointment'
  | 'view_amounts'
  | 'manage_clients'
  | 'view_private_notes'
  | 'view_sensitive_records'
  | 'manage_services'
  | 'manage_team'
  | 'manage_stock'
  | 'view_reports'
  | 'export_data'
  | 'change_settings';

const MATRIX: Readonly<Record<TenantRole, ReadonlySet<Permission>>> = {
  owner: new Set([
    'view_agenda',
    'create_appointment',
    'edit_appointment',
    'complete_appointment',
    'view_amounts',
    'manage_clients',
    'view_private_notes',
    'view_sensitive_records',
    'manage_services',
    'manage_team',
    'manage_stock',
    'view_reports',
    'export_data',
    'change_settings',
  ]),
  manager: new Set([
    'view_agenda',
    'create_appointment',
    'edit_appointment',
    'complete_appointment',
    'view_amounts',
    'manage_clients',
    'view_private_notes',
    'view_sensitive_records',
    'manage_services',
    'manage_stock',
    'view_reports',
    'export_data',
  ]),
  receptionist: new Set([
    'view_agenda',
    'create_appointment',
    'edit_appointment',
    'manage_clients',
  ]),
  // "só a própria" (agenda/conclusão) is a row-level restriction (which appointment),
  // not a role-level one — out of scope for this boolean matrix, enforced separately
  // wherever a provider's own appointments are queried.
  provider: new Set(['view_agenda', 'complete_appointment']),
  viewer: new Set(['view_agenda', 'view_amounts', 'view_reports']),
};

export function hasPermission(role: TenantRole, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

export function permissionsForRole(role: TenantRole): readonly Permission[] {
  return Array.from(MATRIX[role]);
}
