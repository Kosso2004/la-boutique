create table if not exists public.avis_produits (
    id uuid primary key default gen_random_uuid(),
    produit_id uuid not null references public.produits(id) on delete cascade,
    nom_client text not null check (char_length(btrim(nom_client)) between 2 and 80),
    email_client text,
    note smallint not null check (note between 1 and 5),
    commentaire text not null check (char_length(btrim(commentaire)) between 5 and 1000),
    created_at timestamptz not null default now()
);

create index if not exists avis_produits_produit_date_idx
    on public.avis_produits (produit_id, created_at desc);

alter table public.avis_produits enable row level security;

grant select, insert on public.avis_produits to anon, authenticated;

drop policy if exists "Les avis sont publics" on public.avis_produits;
create policy "Les avis sont publics"
on public.avis_produits
for select
to anon, authenticated
using (true);

drop policy if exists "Publier un avis valide" on public.avis_produits;
create policy "Publier un avis valide"
on public.avis_produits
for insert
to anon, authenticated
with check (
    char_length(btrim(nom_client)) between 2 and 80
    and note between 1 and 5
    and char_length(btrim(commentaire)) between 5 and 1000
);
