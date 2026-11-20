const trackingForm = document.getElementById('tracking-form');
const trackingMessage = document.getElementById('tracking-message');
const trackingResult = document.getElementById('tracking-result');

trackingForm.addEventListener('submit', async event => {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(trackingForm));
    const button = trackingForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Recherche...';
    trackingMessage.textContent = '';
    trackingResult.hidden = true;
    trackingResult.replaceChildren();

    try {
        const { data: commande, error } = await window.supabaseClient.rpc(
            'suivre_commande',
            {
                p_numero_commande: values.numero_commande.trim(),
                p_email: values.email.trim()
            }
        );

        if (error) throw error;

        if (!commande) {
            trackingMessage.textContent = 'Aucune commande ne correspond à ces informations.';
            return;
        }

        afficherCommande(commande);
    } catch (error) {
        console.error('Erreur de suivi de commande :', error);
        trackingMessage.textContent = 'Le suivi est indisponible pour le moment. Réessayez plus tard.';
    } finally {
        button.disabled = false;
        button.textContent = 'Rechercher ma commande';
    }
});

function afficherCommande(commande) {
    const numero = document.createElement('h2');
    numero.textContent = `Commande ${commande.numero_commande}`;

    const status = document.createElement('p');
    status.className = 'tracking-status';
    status.textContent = `État : ${commande.statut || 'En attente'}`;

    const date = document.createElement('p');
    date.textContent = commande.created_at
        ? `Passée le ${new Date(commande.created_at).toLocaleDateString('fr-FR')}`
        : '';

    const total = document.createElement('p');
    total.className = 'tracking-total';
    total.textContent = `Montant total : ${Number(commande.montant_total || 0).toLocaleString('fr-FR')} FCFA`;

    const title = document.createElement('h3');
    title.textContent = 'Articles commandés';

    const list = document.createElement('div');
    list.className = 'tracking-items';

    for (const article of commande.articles || []) {
        const row = document.createElement('div');
        row.className = 'tracking-item';

        const name = document.createElement('span');
        name.textContent = article.nom || 'Produit indisponible';

        const detail = document.createElement('span');
        detail.textContent = `${article.quantite} × ${Number(article.prix_unitaire || 0).toLocaleString('fr-FR')} FCFA`;

        row.append(name, detail);
        list.appendChild(row);
    }

    if (!list.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'Aucun détail d’article disponible.';
        list.appendChild(empty);
    }

    trackingResult.replaceChildren(numero, status, date, total, title, list);
    trackingResult.hidden = false;
}

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.header nav');

    if (!toggle || !nav) return;

    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('mobile-open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });

    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('mobile-open');
            toggle.setAttribute('aria-expanded', 'false');
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 800) {
            nav.classList.remove('mobile-open');
            toggle.setAttribute('aria-expanded', 'false');
        }
    });
});
