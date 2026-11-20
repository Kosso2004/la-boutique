create or replace function public.suivre_commande(
    p_numero_commande text,
    p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    resultat jsonb;
begin
    select jsonb_build_object(
        'numero_commande', c.numero_commande,
        'montant_total', c.montant_total,
        'statut', c.statut,
        'created_at', c.created_at,
        'articles', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'nom', p.nom,
                    'quantite', lc.quantite,
                    'prix_unitaire', lc.prix_unitaire
                )
                order by p.nom
            )
            from public.lignes_commande lc
            left join public.produits p on p.id = lc.produit_id
            where lc.commande_id = c.id
        ), '[]'::jsonb)
    )
    into resultat
    from public.commandes c
    join public.clients cl on cl.id = c.client_id
    where lower(btrim(c.numero_commande)) = lower(btrim(p_numero_commande))
      and lower(btrim(cl.email)) = lower(btrim(p_email))
    limit 1;

    return resultat;
end;
$$;

revoke all on function public.suivre_commande(text, text) from public;
grant execute on function public.suivre_commande(text, text) to anon, authenticated;
