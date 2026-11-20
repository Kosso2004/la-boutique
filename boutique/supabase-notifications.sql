create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    type text not null check (type in ('nouvelle_commande', 'stock_faible', 'statut_commande')),
    titre text not null,
    message text not null,
    entite_id uuid,
    lue boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists notifications_lue_date_idx
    on public.notifications (lue, created_at desc);

alter table public.notifications enable row level security;
grant select, update on public.notifications to authenticated;

drop policy if exists "Admins can read notifications" on public.notifications;
create policy "Admins can read notifications"
on public.notifications
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can update notifications" on public.notifications;
create policy "Admins can update notifications"
on public.notifications
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.notifier_nouvelle_commande()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.notifications (type, titre, message, entite_id)
    values (
        'nouvelle_commande',
        'Nouvelle commande',
        'Commande ' || coalesce(new.numero_commande, new.id::text) ||
            ' — ' || to_char(coalesce(new.montant_total, 0), 'FM999G999G999G990') || ' FCFA',
        new.id
    );
    return new;
end;
$$;

drop trigger if exists notifier_nouvelle_commande on public.commandes;
create trigger notifier_nouvelle_commande
after insert on public.commandes
for each row execute function public.notifier_nouvelle_commande();

create or replace function public.notifier_changement_statut_commande()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.statut is distinct from old.statut then
        insert into public.notifications (type, titre, message, entite_id)
        values (
            'statut_commande',
            'Statut de commande modifié',
            'Commande ' || coalesce(new.numero_commande, new.id::text) ||
                ' : ' || coalesce(old.statut, 'sans statut') || ' → ' || coalesce(new.statut, 'sans statut'),
            new.id
        );
    end if;
    return new;
end;
$$;

drop trigger if exists notifier_changement_statut_commande on public.commandes;
create trigger notifier_changement_statut_commande
after update of statut on public.commandes
for each row execute function public.notifier_changement_statut_commande();

create or replace function public.notifier_stock_faible()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if coalesce(new.stock, 0) <= 5 and (
        tg_op = 'INSERT' or coalesce(old.stock, 0) > 5
    ) then
        insert into public.notifications (type, titre, message, entite_id)
        values (
            'stock_faible',
            'Stock faible',
            coalesce(new.nom, 'Produit') || ' : ' || coalesce(new.stock, 0) || ' unité(s) restante(s)',
            new.id
        );
    end if;
    return new;
end;
$$;

drop trigger if exists notifier_stock_faible on public.produits;
create trigger notifier_stock_faible
 after insert or update of stock on public.produits
for each row execute function public.notifier_stock_faible();
