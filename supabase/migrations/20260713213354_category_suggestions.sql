alter table categories
  add column is_suggested boolean not null default false;

create index categories_suggestions_idx
  on categories (kind, name)
  where is_suggested = true and parent_id is null;

create policy "suggested root categories read"
  on categories for select to authenticated
  using (is_suggested = true and parent_id is null);
