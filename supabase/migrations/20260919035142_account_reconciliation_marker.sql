-- El marcador es informativo: no altera saldos ni bloquea movimientos antiguos.
alter table public.accounts
  add column reconciled_through date,
  add column reconciliation_note text;

alter table public.accounts
  add constraint accounts_reconciliation_note_length
  check (reconciliation_note is null or char_length(reconciliation_note) <= 1000);
