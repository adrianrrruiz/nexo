-- Services share the recurring reminder lifecycle, with an estimated amount,
-- a payment window, and an optional funding account.
alter table public.subscriptions
  add column kind text not null default 'subscription',
  add column started_until date,
  add column next_charge_until date,
  alter column account_id drop not null,
  add constraint subscriptions_kind_check check (kind in ('subscription', 'service')),
  add constraint subscriptions_account_required check (kind = 'service' or account_id is not null),
  add constraint subscriptions_payment_window_check check (
    (kind = 'subscription' and started_until is null and next_charge_until is null)
    or (kind = 'service' and started_until is not null and next_charge_until is not null
      and started_until >= started_on and next_charge_until >= next_charge_on)
  );

alter policy "own subscriptions" on public.subscriptions
with check (
  (select auth.uid()) = user_id
  and (
    (kind = 'service' and account_id is null)
    or exists (select 1 from public.accounts a
      where a.id = subscriptions.account_id and a.user_id = (select auth.uid()))
  )
  and (category_id is null or exists (select 1 from public.categories c
    where c.id = subscriptions.category_id and c.user_id = (select auth.uid())))
);

create function public.advance_recurring_date(
  p_current date, p_frequency public.subscription_frequency, p_anchor date
) returns date
language plpgsql immutable strict security invoker set search_path = '' as $$
declare
  target date;
  months integer;
begin
  if p_frequency = 'weekly' then return p_current + 7; end if;
  months := case p_frequency when 'monthly' then 1 when 'bimonthly' then 2
    when 'quarterly' then 3 when 'semiannual' then 6 when 'yearly' then 12 end;
  target := (date_trunc('month', p_current) + make_interval(months => months))::date;
  return target + (least(extract(day from p_anchor)::integer,
    extract(day from (target + interval '1 month - 1 day'))::integer) - 1);
end;
$$;
revoke all on function public.advance_recurring_date(date, public.subscription_frequency, date) from public, anon;
grant execute on function public.advance_recurring_date(date, public.subscription_frequency, date) to authenticated;

-- Lock and advance the expected occurrence in the same transaction as the
-- expense insert. Retrying a stale reminder cannot duplicate a payment.
create function public.process_recurring_charge(
  p_subscription_id uuid,
  p_expected_charge_on date,
  p_skip boolean default false,
  p_amount numeric default null,
  p_account_id uuid default null,
  p_charged_on date default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  item public.subscriptions%rowtype;
  chosen_account uuid;
  actual_amount numeric;
  charged_on date;
  today date := (now() at time zone 'America/Bogota')::date;
begin
  if auth.uid() is null or (auth.jwt() ->> 'client_id') is not null then
    raise exception 'Sesión no autorizada.';
  end if;
  select * into item from public.subscriptions
    where id = p_subscription_id and user_id = auth.uid() for update;
  if not found then raise exception 'Recordatorio no encontrado.'; end if;
  if not item.active or item.next_charge_on > today then
    raise exception 'Este cobro aún no está pendiente.';
  end if;
  if item.next_charge_on is distinct from p_expected_charge_on then
    raise exception 'Este recordatorio ya se actualizó. Recarga la página.';
  end if;
  if not p_skip then
    chosen_account := coalesce(p_account_id, item.account_id);
    actual_amount := coalesce(p_amount, item.amount);
    charged_on := coalesce(p_charged_on, item.next_charge_on);
    if actual_amount <= 0 or actual_amount in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
      raise exception 'Escribe un monto válido.';
    end if;
    if charged_on > today then raise exception 'La fecha del gasto no puede estar en el futuro.'; end if;
    if not exists (select 1 from public.accounts a where a.id = chosen_account
      and a.user_id = auth.uid() and not a.archived) then
      raise exception 'Elige una cuenta activa para registrar el gasto.';
    end if;
    insert into public.transactions (user_id, type, amount, occurred_at, account_id,
      category_id, note, source, subscription_id)
    values (auth.uid(), 'expense', actual_amount, (charged_on + time '12:00') at time zone 'America/Bogota',
      chosen_account, item.category_id,
      case when item.note is null then item.name else item.name || ' · ' || item.note end,
      'subscription', item.id);
  end if;
  update public.subscriptions set
    last_charged_on = case when p_skip then last_charged_on else charged_on end,
    next_charge_on = public.advance_recurring_date(item.next_charge_on, item.frequency, item.started_on),
    next_charge_until = public.advance_recurring_date(item.next_charge_until, item.frequency, item.started_until)
  where id = item.id and user_id = auth.uid();
end;
$$;
revoke all on function public.process_recurring_charge(uuid, date, boolean, numeric, uuid, date) from public, anon;
grant execute on function public.process_recurring_charge(uuid, date, boolean, numeric, uuid, date) to authenticated;
notify pgrst, 'reload schema';
