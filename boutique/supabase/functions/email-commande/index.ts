import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

Deno.serve(async request => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return Response.json({ error: 'Méthode non autorisée.' }, {
            status: 405,
            headers: corsHeaders
        });
    }

    try {
        const { numero_commande, email } = await request.json();
        const numero = String(numero_commande ?? '').trim();
        const adresse = String(email ?? '').trim().toLowerCase();

        if (!numero || !adresse) {
            return Response.json({ error: 'Numéro et e-mail requis.' }, {
                status: 400,
                headers: corsHeaders
            });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        const emailFrom = Deno.env.get('EMAIL_FROM');

        if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
            console.error('Secrets manquants pour email-commande.');
            return Response.json({ error: 'Service e-mail non configuré.' }, {
                status: 503,
                headers: corsHeaders
            });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: commande, error: erreurCommande } = await supabase
            .from('commandes')
            .select('id, client_id, numero_commande, montant_total, statut, created_at')
            .eq('numero_commande', numero)
            .maybeSingle();

        if (erreurCommande) throw erreurCommande;
        if (!commande?.client_id) {
            return Response.json({ error: 'Commande introuvable.' }, {
                status: 404,
                headers: corsHeaders
            });
        }

        const { data: client, error: erreurClient } = await supabase
            .from('clients')
            .select('nom, email')
            .eq('id', commande.client_id)
            .maybeSingle();

        if (erreurClient) throw erreurClient;
        if (!client?.email || client.email.trim().toLowerCase() !== adresse) {
            return Response.json({ error: 'Commande introuvable.' }, {
                status: 404,
                headers: corsHeaders
            });
        }

        const { data: lignes, error: erreurLignes } = await supabase
            .from('lignes_commande')
            .select('produit_id, quantite, prix_unitaire')
            .eq('commande_id', commande.id);

        if (erreurLignes) throw erreurLignes;

        const idsProduits = [...new Set((lignes || []).map(ligne => ligne.produit_id))];
        const nomsProduits = new Map<string, string>();

        if (idsProduits.length) {
            const { data: produits, error: erreurProduits } = await supabase
                .from('produits')
                .select('id, nom')
                .in('id', idsProduits);

            if (erreurProduits) throw erreurProduits;
            for (const produit of produits || []) {
                nomsProduits.set(String(produit.id), produit.nom);
            }
        }

        const listeArticles = (lignes || []).map(ligne => {
            const nom = nomsProduits.get(String(ligne.produit_id)) || 'Produit';
            const prix = Number(ligne.prix_unitaire || 0).toLocaleString('fr-FR');
            return `<li>${escapeHtml(nom)} × ${Number(ligne.quantite)} — ${prix} FCFA</li>`;
        }).join('');

        const total = Number(commande.montant_total || 0).toLocaleString('fr-FR');
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': `confirmation-commande-${commande.id}`
            },
            body: JSON.stringify({
                from: emailFrom,
                to: [client.email],
                subject: `Confirmation de votre commande ${commande.numero_commande}`,
                html: `
                    <h1>Merci pour votre commande${client.nom ? `, ${escapeHtml(client.nom)}` : ''}.</h1>
                    <p>Votre commande <strong>${escapeHtml(commande.numero_commande)}</strong> a bien été enregistrée.</p>
                    <p>Statut : ${escapeHtml(commande.statut || 'En attente')}</p>
                    <h2>Articles</h2>
                    <ul>${listeArticles}</ul>
                    <p><strong>Total : ${total} FCFA</strong></p>
                `
            })
        });

        if (!response.ok) {
            console.error('Échec Resend :', await response.text());
            return Response.json({ error: 'Envoi de la confirmation impossible.' }, {
                status: 502,
                headers: corsHeaders
            });
        }

        return Response.json({ sent: true }, { headers: corsHeaders });
    } catch (error) {
        console.error('Erreur email-commande :', error);
        return Response.json({ error: 'Erreur interne du service e-mail.' }, {
            status: 500,
            headers: corsHeaders
        });
    }
});
