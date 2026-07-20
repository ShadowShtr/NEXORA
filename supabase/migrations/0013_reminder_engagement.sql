-- NEX-103: "Registar aberto e marcado enviado" — "Estados manuais sem alegar
-- entrega/leitura" (docs/01_PRODUCT_REQUIREMENTS.md §8: "Sistema não afirma entrega ou
-- leitura"). mark_reminder_opened only ever means "a dona clicou em Abrir WhatsApp",
-- never that the client received or read anything — the UI label and this function's
-- own semantics stop at that boundary. mark_reminder_sent is the dona's own manual
-- confirmation that she actually sent the message.
--
-- Both are idempotent by design (a lembrete already marked_sent must survive a second
-- "Abrir WhatsApp" click without regressing to 'opened'; a lembrete already marked_sent
-- calling mark_reminder_sent again is a no-op, not an error) — this task's own
-- acceptance criterion is "auditoria e idempotência", and unlike cancel/reschedule/
-- no_show (which represent a state that can only happen once), a reminder can
-- legitimately be opened/marked-sent more than once in practice (dona reopens
-- WhatsApp to resend). Both derive tenant_id from current_tenant_id(), never a
-- parameter, same as every other authenticated mutation in this codebase.
create or replace function public.mark_reminder_opened(p_reminder_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_reminder record;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  select id, status into v_reminder
  from public.reminders
  where id = p_reminder_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'reminder % not found for tenant', p_reminder_id using errcode = '22023';
  end if;

  -- Only 'pending' advances to 'opened'. 'opened' -> 'opened' is a harmless no-op
  -- (idempotent); 'marked_sent'/'skipped' are left untouched so this can never regress
  -- a state the dona already resolved.
  if v_reminder.status = 'pending' then
    update public.reminders
    set status = 'opened', opened_at = coalesce(opened_at, now())
    where id = p_reminder_id;

    insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
    values (v_tenant_id, auth.uid(), 'reminder.opened', 'reminder', p_reminder_id, '{}'::jsonb);
  end if;
end;
$$;

create or replace function public.mark_reminder_sent(p_reminder_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_reminder record;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  select id, status into v_reminder
  from public.reminders
  where id = p_reminder_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'reminder % not found for tenant', p_reminder_id using errcode = '22023';
  end if;
  if v_reminder.status = 'skipped' then
    raise exception 'reminder % cannot be marked sent from status %', p_reminder_id, v_reminder.status
      using errcode = '22023';
  end if;

  update public.reminders
  set status = 'marked_sent', marked_sent_at = coalesce(marked_sent_at, now())
  where id = p_reminder_id;

  if v_reminder.status <> 'marked_sent' then
    insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
    values (v_tenant_id, auth.uid(), 'reminder.marked_sent', 'reminder', p_reminder_id, '{}'::jsonb);
  end if;
end;
$$;

-- New functions in `public` are reachable by anon/authenticated by default on this
-- project (ADR-008) — revoking from PUBLIC alone does not undo that, so both are
-- revoked explicitly before re-granting only to authenticated.
revoke all on function public.mark_reminder_opened(uuid) from public;
revoke all on function public.mark_reminder_opened(uuid) from anon;
grant execute on function public.mark_reminder_opened(uuid) to authenticated;

revoke all on function public.mark_reminder_sent(uuid) from public;
revoke all on function public.mark_reminder_sent(uuid) from anon;
grant execute on function public.mark_reminder_sent(uuid) to authenticated;
