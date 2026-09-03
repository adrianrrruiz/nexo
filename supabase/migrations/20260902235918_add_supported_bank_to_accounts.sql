create type supported_bank as enum ('nequi', 'rappi', 'nu');

alter table accounts
  add column bank supported_bank;

update accounts
set bank = case
  when lower(name) like '%nequi%' then 'nequi'::supported_bank
  when lower(name) like '%rappi%' then 'rappi'::supported_bank
  when lower(name) like '%nu%' then 'nu'::supported_bank
end;

do $$
begin
  if exists (select 1 from accounts where bank is null) then
    raise exception 'Hay cuentas existentes que no se pudieron asociar a un banco soportado.';
  end if;
end
$$;

alter table accounts
  alter column bank set not null;

drop view account_balances;

create view account_balances
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.bank,
  a.currency,
  a.credit_limit,
  a.image_path,
  a.initial_balance
    + coalesce(sum(t.amount) filter (where t.type = 'income'     and t.account_id = a.id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'    and t.account_id = a.id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'adjustment' and t.account_id = a.id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'transfer'   and t.account_id = a.id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'transfer'   and t.to_account_id = a.id), 0)
    as balance
from accounts a
left join transactions t
  on t.account_id = a.id or t.to_account_id = a.id
group by a.id;
