create table if not exists public.mouvements_stock (
    id uuid primary key default gen_random_uuid(),
    produit_id uuid references public.produits(id) on delete set null,
    produit_nom text not null,
    type text not null check (type in ('ajout', 'diminution', 'reapprovisionnement')),
    quantite numeric not null check (quantite >= 0),
    stock_avant numeric not null check (stock_avant >= 0),
    stock_apres numeric not null check (stock_apres >= 0),
    utilisateur_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.mouvements_stock enable row level security;

grant select on public.mouvements_stock to authenticated;

drop policy if exists "Admins can read stock movements" on public.mouvements_stock;
create policy "Admins can read stock movements"
on public.mouvements_stock
for select
to authenticated
using (public.is_admin());

create or replace function public.journaliser_mouvement_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    stock_precedent numeric;
    stock_actuel numeric;
    type_mouvement text;
begin
    stock_actuel := coalesce(new.stock, 0);

    if tg_op = 'INSERT' then
        insert into public.mouvements_stock (
            produit_id, produit_nom, type, quantite,
            stock_avant, stock_apres, utilisateur_id
        ) values (
            new.id, new.nom, 'ajout', stock_actuel,
            0, stock_actuel, auth.uid()
        );
        return new;
    end if;

    stock_precedent := coalesce(old.stock, 0);

    if stock_actuel is distinct from stock_precedent then
        type_mouvement := case
            when stock_actuel > stock_precedent then 'reapprovisionnement'
            else 'diminution'
        end;

        insert into public.mouvements_stock (
            produit_id, produit_nom, type, quantite,
            stock_avant, stock_apres, utilisateur_id
        ) values (
            new.id, new.nom, type_mouvement,
            abs(stock_actuel - stock_precedent),
            stock_precedent, stock_actuel, auth.uid()
        );
    end if;

    return new;
end;
$$;

drop trigger if exists journaliser_mouvement_stock on public.produits;
create trigger journaliser_mouvement_stock
after insert or update on public.produits
for each row
execute function public.journaliser_mouvement_stock();
