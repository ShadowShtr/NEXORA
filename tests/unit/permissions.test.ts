import { describe, expect, it } from 'vitest';
import { hasPermission, type Permission, type TenantRole } from '@/lib/auth/permissions';

// NEX-211: transcribes docs/PERMISSION_MATRIX.md's table verbatim (Sim/Não per
// role/permission) — if the two ever drift, this test is what catches it, not a
// re-statement of src/lib/auth/permissions.ts's own implementation.
const DOCUMENTED_MATRIX: Record<Permission, Record<TenantRole, boolean>> = {
  view_agenda: { owner: true, manager: true, receptionist: true, provider: true, viewer: true },
  create_appointment: {
    owner: true,
    manager: true,
    receptionist: true,
    provider: false,
    viewer: false,
  },
  edit_appointment: {
    owner: true,
    manager: true,
    receptionist: true,
    provider: false,
    viewer: false,
  },
  complete_appointment: {
    owner: true,
    manager: true,
    receptionist: false,
    provider: true,
    viewer: false,
  },
  view_amounts: { owner: true, manager: true, receptionist: false, provider: false, viewer: true },
  manage_clients: {
    owner: true,
    manager: true,
    receptionist: true,
    provider: false,
    viewer: false,
  },
  view_private_notes: {
    owner: true,
    manager: true,
    receptionist: false,
    provider: false,
    viewer: false,
  },
  view_sensitive_records: {
    owner: true,
    manager: true,
    receptionist: false,
    provider: false,
    viewer: false,
  },
  manage_services: {
    owner: true,
    manager: true,
    receptionist: false,
    provider: false,
    viewer: false,
  },
  manage_team: { owner: true, manager: false, receptionist: false, provider: false, viewer: false },
  manage_stock: { owner: true, manager: true, receptionist: false, provider: false, viewer: false },
  view_reports: { owner: true, manager: true, receptionist: false, provider: false, viewer: true },
  export_data: { owner: true, manager: true, receptionist: false, provider: false, viewer: false },
  change_settings: {
    owner: true,
    manager: false,
    receptionist: false,
    provider: false,
    viewer: false,
  },
};

const ROLES: TenantRole[] = ['owner', 'manager', 'receptionist', 'provider', 'viewer'];
const PERMISSIONS = Object.keys(DOCUMENTED_MATRIX) as Permission[];

describe('hasPermission (NEX-211: docs/PERMISSION_MATRIX.md)', () => {
  for (const permission of PERMISSIONS) {
    for (const role of ROLES) {
      const expected = DOCUMENTED_MATRIX[permission][role];
      it(`${role} ${expected ? 'can' : 'cannot'} ${permission}`, () => {
        expect(hasPermission(role, permission)).toBe(expected);
      });
    }
  }

  it('owner has every permission (documented as "sim a tudo")', () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission('owner', permission)).toBe(true);
    }
  });

  it('only owner can manage_team or change_settings', () => {
    for (const role of ROLES.filter((r) => r !== 'owner')) {
      expect(hasPermission(role, 'manage_team')).toBe(false);
      expect(hasPermission(role, 'change_settings')).toBe(false);
    }
  });

  it('viewer has no write permission at all', () => {
    const writePermissions: Permission[] = [
      'create_appointment',
      'edit_appointment',
      'complete_appointment',
      'manage_clients',
      'manage_services',
      'manage_team',
      'manage_stock',
      'export_data',
      'change_settings',
    ];
    for (const permission of writePermissions) {
      expect(hasPermission('viewer', permission)).toBe(false);
    }
  });
});
