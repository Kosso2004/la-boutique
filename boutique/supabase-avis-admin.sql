alter table public.avis enable row level security;

grant select, update on public.avis to authenticated;

drop policy if exists "Admins can view all reviews" on public.avis;
create policy "Admins can view all reviews"
on public.avis
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can moderate reviews" on public.avis;
create policy "Admins can moderate reviews"
on public.avis
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
