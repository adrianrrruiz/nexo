alter table accounts
  add column if not exists credit_limit numeric(18, 2);

update accounts
set type = 'credit',
    credit_limit = 1000000.00
where name = 'La primera - Nu';

update accounts
set type = 'credit',
    credit_limit = 4100000.00
where name = 'Rappi Crédito';

drop view if exists account_balances;

create view account_balances
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.credit_limit,
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
