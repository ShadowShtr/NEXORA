-- Development-only seed. Never use real client data.
insert into public.tenants (id, slug, name, status)
values ('00000000-0000-4000-8000-000000000001', 'demo-nails', 'Demo Nails', 'active')
on conflict do nothing;

insert into public.business_settings (tenant_id, professional_name, phone_e164, address_line, postal_code, locality, published_at)
values ('00000000-0000-4000-8000-000000000001', 'Ana', '+351910000000', 'Rua Exemplo, 1', '1000-001', 'Lisboa', now())
on conflict do nothing;

insert into public.service_categories (id, tenant_id, name, sort_order)
values
('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Manicure', 1),
('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'Pedicure', 2)
on conflict do nothing;

insert into public.services (tenant_id, category_id, name, price_cents, duration_minutes, sort_order)
values
('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Verniz gel', 2500, 60, 1),
('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Pedicure', 3000, 60, 1)
on conflict do nothing;
