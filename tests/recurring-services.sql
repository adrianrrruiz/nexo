-- Run after the migration. Every fixture and expense is rolled back.
begin;
insert into auth.users (id, email) values
  ('f9000000-0000-4000-8000-000000000001', 'nexo-mobile-qa@example.invalid'),
  ('f9000000-0000-4000-8000-000000000002', 'nexo-other-qa@example.invalid');
insert into public.accounts (id,user_id,name,type,bank) values
  ('f9000000-0000-4000-8000-000000000003','f9000000-0000-4000-8000-000000000001','QA isolated account','debit','finandina'),
  ('f9000000-0000-4000-8000-000000000004','f9000000-0000-4000-8000-000000000002','QA other account','debit','nu');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'f9000000-0000-4000-8000-000000000001', true);
do $$
declare
  today date := (now() at time zone 'America/Bogota')::date;
  blocked boolean;
  expense_count integer;
begin
  if public.advance_recurring_date('2026-01-31','monthly','2026-01-31') <> '2026-02-28'::date
    or public.advance_recurring_date('2026-02-28','monthly','2026-01-31') <> '2026-03-31'::date
    or public.advance_recurring_date('2028-01-31','monthly','2028-01-31') <> '2028-02-29'::date
    or public.advance_recurring_date('2026-10-01','weekly','2026-10-01') <> '2026-10-08'::date then
    raise exception 'Calendar anchor regression';
  end if;
  insert into public.subscriptions (id,user_id,name,kind,amount,account_id,frequency,started_on,started_until,next_charge_on,next_charge_until)
  values ('f9000000-0000-4000-8000-000000000005',auth.uid(),'QA estimated service','service',170000.50,null,'monthly',today-2,today+2,today-2,today+2),
    ('f9000000-0000-4000-8000-000000000006',auth.uid(),'QA skipped service','service',50000,null,'monthly',today,today+3,today,today+3);
  blocked := false;
  begin
    perform public.process_recurring_charge('f9000000-0000-4000-8000-000000000005',today-2,false,165000.75,'f9000000-0000-4000-8000-000000000004',today);
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Cross-user account was accepted'; end if;
  blocked := false;
  begin
    perform public.process_recurring_charge('f9000000-0000-4000-8000-000000000005',today-2,false);
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Missing actual account was accepted'; end if;
  perform public.process_recurring_charge('f9000000-0000-4000-8000-000000000005',today-2,false,165000.75,'f9000000-0000-4000-8000-000000000003',today);
  if not exists (select 1 from public.transactions where subscription_id = 'f9000000-0000-4000-8000-000000000005' and amount = 165000.75 and account_id = 'f9000000-0000-4000-8000-000000000003') then
    raise exception 'Actual expense did not match';
  end if;
  if not exists (select 1 from public.subscriptions where id = 'f9000000-0000-4000-8000-000000000005'
    and next_charge_on = public.advance_recurring_date(today-2,'monthly',today-2)
    and next_charge_until = public.advance_recurring_date(today+2,'monthly',today+2)
    and amount = 170000.50 and account_id is null) then
    raise exception 'Payment window or estimate was changed incorrectly';
  end if;
  blocked := false;
  begin
    perform public.process_recurring_charge('f9000000-0000-4000-8000-000000000005',today-2,false,165000.75,'f9000000-0000-4000-8000-000000000003',today);
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Stale occurrence was accepted'; end if;
  select count(*) into expense_count from public.transactions where subscription_id = 'f9000000-0000-4000-8000-000000000005';
  if expense_count <> 1 then raise exception 'Expense was duplicated'; end if;
  perform public.process_recurring_charge('f9000000-0000-4000-8000-000000000006',today,true);
  if exists (select 1 from public.transactions where subscription_id = 'f9000000-0000-4000-8000-000000000006') then
    raise exception 'Dismissing reminder created an expense';
  end if;
  if not exists (select 1 from public.subscriptions where id = 'f9000000-0000-4000-8000-000000000006' and next_charge_on > today and next_charge_until > today + 3) then
    raise exception 'Dismissed range did not advance';
  end if;
  -- An invalid range is rejected even through direct Data API access.
  blocked := false;
  begin
    insert into public.subscriptions (user_id,name,kind,amount,frequency,started_on,started_until,next_charge_on,next_charge_until)
    values (auth.uid(),'QA invalid range','service',10,'monthly',today,today-1,today,today-1);
  exception when check_violation then blocked := true; end;
  if not blocked then raise exception 'Invalid range was accepted'; end if;
end $$;
-- Anonymous and OAuth MCP callers must not mutate recurring charges.
reset role;
do $$ begin
  if has_function_privilege('anon','public.process_recurring_charge(uuid,date,boolean,numeric,uuid,date)','execute') then
    raise exception 'Anonymous RPC access';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"qa-oauth"}', true);
do $$ declare blocked boolean := false; begin
  begin
    perform public.process_recurring_charge('f9000000-0000-4000-8000-000000000006',(now() at time zone 'America/Bogota')::date,true);
  exception when others then blocked := true; end;
  if not blocked then raise exception 'OAuth write was accepted'; end if;
end $$;
rollback;
select 'Recurring services, expenses, dismissal, anchors and access checks passed; fixtures rolled back.' as result;
