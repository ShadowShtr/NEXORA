import { createClient } from '@supabase/supabase-js';

// Admin-only bootstrap: there is no public sign-up in this version (CLAUDE.md).
// Usage:
//   node scripts/provision-owner.mjs --email <email> --slug <slug> --business-name <nome> --owner-name <nome-dona> [--apply]
// Dry run by default; pass --apply to actually create the Auth user and provision the tenant.

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

const apply = process.argv.includes('--apply');
const email = arg('email');
const slug = arg('slug');
const businessName = arg('business-name');
const ownerName = arg('owner-name');

if (!email || !slug || !businessName || !ownerName) {
  console.error(
    'Uso: node scripts/provision-owner.mjs --email <email> --slug <slug> --business-name <nome> --owner-name <nome-dona> [--apply]',
  );
  process.exit(1);
}

console.log(
  `Plano: criar utilizador Auth (${email}), depois provisionar tenant "${businessName}" (slug: ${slug}) com owner "${ownerName}".`,
);

if (!apply) {
  console.log('\nDry run. Execute com --apply para aplicar de facto.');
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error(
    'Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (nunca em ficheiro commitado).',
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey);

const { data: userData, error: userError } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
});
if (userError) {
  console.error('Falha ao criar utilizador Auth:', userError.message);
  process.exit(1);
}

const { data: tenantId, error: rpcError } = await admin.rpc('provision_tenant_owner', {
  p_user_id: userData.user.id,
  p_slug: slug,
  p_business_name: businessName,
  p_owner_display_name: ownerName,
});

if (rpcError) {
  console.error(
    'Falha ao provisionar tenant/profile/settings (rollback automático):',
    rpcError.message,
  );
  console.error(
    `O utilizador Auth ${userData.user.id} foi criado mas ficou sem tenant associado — remova-o manualmente no dashboard do Supabase ou repita o comando com o mesmo e-mail.`,
  );
  process.exit(1);
}

console.log(`Provisionado com sucesso. tenant_id=${tenantId}, user_id=${userData.user.id}`);
console.log(
  'A password de acesso ainda não foi definida — envie um link de recuperação de password à dona (fluxo de NEX-021) para que ela a defina.',
);
