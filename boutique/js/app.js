let products = [];

function normalizeCategory(category) {
	const normalized = (category || '')
		.trim()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

	if (normalized === 'decoration') return 'deco';
	if (normalized === 'linge de maison') return 'linge';
	return normalized || 'deco';
}

async function loadProducts() {
	const { data, error } = await window.supabaseClient
		.from('produits')
		.select('*')
		.eq('actif', true);

	if (error) {
		console.error("Erreur Supabase :", error.message);
		alert("Impossible de charger les produits.");
		return;
	}

	products = data.map(p => ({
		id: p.id,
		name: p.nom,
		category: normalizeCategory(p.categorie),
		price: Number(p.prix),
		desc: p.description || '',
		image: p.image_url || ''
	}));

}
const money=n=>new Intl.NumberFormat('fr-FR').format(n)+' FCFA';
const getCart = () => {
    try {
        const stored = JSON.parse(localStorage.getItem('lb-cart') || '[]');
        if (!Array.isArray(stored)) return [];
        return stored
            .filter(item => item && (typeof item.id === 'string' || typeof item.id === 'number'))
            .map(item => ({ id: item.id, qty: Math.max(1, Math.floor(Number(item.qty) || 1)) }));
    } catch (error) {
        console.warn('Panier local illisible : réinitialisation.', error);
        return [];
    }
};
const saveCart = cart => { localStorage.setItem('lb-cart', JSON.stringify(cart)); updateCount(); };
function updateCount() {
    document.querySelectorAll('.cart-count').forEach(element => {
        element.textContent = getCart().reduce((sum, item) => sum + item.qty, 0);
    });
}
function addCart(id, qty = 1) {
    const quantity = Math.max(1, Math.floor(Number(qty) || 1));
    const cart = getCart();
    const item = cart.find(entry => String(entry.id) === String(id));
    if (item) item.qty += quantity;
    else cart.push({ id, qty: quantity });
    saveCart(cart);
    alert('Produit ajouté au panier.');
}
function safeImageUrl(value) {
    try {
        const url = new URL(String(value || ''), window.location.href);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}
function card(product) {
    const name = escapeHTML(product.name);
    const image = escapeHTML(safeImageUrl(product.image));
    const id = encodeURIComponent(String(product.id));
    const category = product.category === 'deco' ? 'Décoration'
        : product.category === 'mobilier' ? 'Mobilier' : 'Linge de maison';
    return `<article class="product-card"><a class="image-link" href="produit.html?id=${id}"><img src="${image}" alt="${name}"><span class="quick">Découvrir →</span></a><h3>${name}</h3><p>${category}</p><div class="price">${money(product.price)}</div></article>`;
}
function renderProducts(){const featured=document.getElementById('featured-products');if(featured)featured.innerHTML=products.slice(0,3).map(card).join('');const list=document.getElementById('all-products');if(!list)return;let params=new URLSearchParams(location.search),initial=params.get('cat')||'all';document.querySelectorAll('[name=category]').forEach(r=>r.checked=r.value===initial);function draw(){let cat=document.querySelector('[name=category]:checked')?.value||'all',sort=document.getElementById('sort').value;let arr=products.filter(p=>cat==='all'||p.category===cat);if(sort==='asc')arr.sort((a,b)=>a.price-b.price);if(sort==='desc')arr.sort((a,b)=>b.price-a.price);list.innerHTML=arr.map(card).join('')||'<p>Aucun produit dans cette catégorie.</p>';document.getElementById('result-count').textContent=arr.length+' produits'}document.querySelectorAll('[name=category]').forEach(r=>r.addEventListener('change',draw));document.getElementById('sort').addEventListener('change',draw);draw()}
function renderProduct() {
    const root = document.getElementById('product-detail');
    if (!root) return;

    const requestedId = new URLSearchParams(location.search).get('id');
    const product = products.find(item => String(item.id) === requestedId)
        || (!requestedId ? products[0] : null);

    if (!product) {
        root.innerHTML = '<p class="muted">Produit introuvable.</p>';
        return;
    }

    root.innerHTML = `
        <div class="product-detail">
            <img src="${escapeHTML(safeImageUrl(product.image))}" alt="${escapeHTML(product.name)}">

            <div class="product-info">
                <p class="eyebrow">LA COLLECTION / ${escapeHTML(product.category.toUpperCase())}</p>
                <h1>${escapeHTML(product.name)}</h1>
                <div class="price">${money(product.price)}</div>
                <p class="description">${escapeHTML(product.desc).replace(/\r?\n/g, '<br>')}</p>

                <label>
                    Quantité
                    <input id="quantity" type="number" min="1" max="20" value="1">
                </label>

                <button class="btn" id="add-product">Ajouter au panier</button>
                <p class="muted tiny">Livraison disponible à Bamako.</p>
            </div>
        </div>

        <section class="reviews-section">
            <h2>Avis des clients</h2>
            <p id="reviews-summary" class="muted tiny">Chargement des avis...</p>
            <div id="reviews-list" class="reviews-list"></div>

            <div class="panel review-form-panel">
                <h3>Donnez votre avis</h3>
                <form id="review-form">
                    <label>
                        Votre nom
                        <input type="text" name="nom_client" minlength="2" maxlength="80"
                            placeholder="Votre nom" required>
                    </label>
                    <label>
                        Votre adresse e-mail (facultatif)
                        <input type="email" name="email_client" placeholder="vous@exemple.com">
                    </label>
                    <label>
                        Votre note
                        <select name="note" required>
                            <option value="">Choisir une note</option>
                            <option value="5">★★★★★ - Excellent</option>
                            <option value="4">★★★★ - Très bien</option>
                            <option value="3">★★★ - Bien</option>
                            <option value="2">★★ - Moyen</option>
                            <option value="1">★ - Mauvais</option>
                        </select>
                    </label>
                    <label>
                        Votre commentaire
                        <textarea name="commentaire" minlength="5" maxlength="1000" rows="4"
                            placeholder="Que pensez-vous de ce produit ?" required></textarea>
                    </label>
                    <button type="submit" class="btn">Envoyer mon avis</button>
                    <p id="review-message" class="muted tiny" role="status"></p>
                </form>
            </div>
        </section>
    `;

    document.getElementById('add-product').onclick = () => {
        addCart(
            product.id,
            Math.max(1, Number(document.getElementById('quantity').value) || 1)
        );
    };

    loadProductReviews(product.id);
    setupReviewForm(product.id);
}
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

// Afficher les avis approuvés
async function loadProductReviews(productId) {
    const list = document.getElementById('reviews-list');
    const summary = document.getElementById('reviews-summary');

    if (!list || !summary) return;

    const { data, error } = await window.supabaseClient
        .from('avis')
        .select('nom_client, note, commentaire, created_at')
        .eq('produit_id', String(productId))
        .eq('statut', 'approuvé')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur de chargement des avis :', error);
        summary.textContent = 'Impossible de charger les avis.';
        return;
    }

    if (!data || data.length === 0) {
        summary.textContent = 'Aucun avis pour ce produit.';
        list.innerHTML = '';
        return;
    }

    const moyenne = data.reduce(
        (total, avis) => total + Number(avis.note), 0
    ) / data.length;

    summary.textContent =
        `${data.length} avis — Note moyenne : ${moyenne.toFixed(1)}/5`;

    list.innerHTML = data.map(avis => `
        <article class="review-item">
            <div class="review-item-header">
                <strong>${escapeHTML(avis.nom_client)}</strong>
                <span class="review-stars">
                    ${'★'.repeat(Number(avis.note))}
                    ${'☆'.repeat(5 - Number(avis.note))}
                </span>
            </div>
            <p>${escapeHTML(avis.commentaire).replace(/\r?\n/g, '<br>')}</p>
            <small>${new Date(avis.created_at).toLocaleDateString('fr-FR')}</small>
        </article>
    `).join('');
}

// Enregistrer un nouvel avis
function setupReviewForm(productId) {
    const form = document.getElementById('review-form');
    const message = document.getElementById('review-message');

    if (!form || !message) return;

    form.onsubmit = async function(e) {
        e.preventDefault();

        const data = Object.fromEntries(new FormData(form));
        const button = form.querySelector('button[type="submit"]');

        button.disabled = true;
        message.textContent = 'Envoi en cours...';

        try {
            const { error } = await window.supabaseClient
                .from('avis')
                .insert({
                    produit_id: String(productId),
                    nom_client: data.nom_client.trim(),
                    email_client: data.email_client.trim() || null,
                    note: Number(data.note),
                    commentaire: data.commentaire.trim(),
                    statut: 'en attente'
                });

            if (error) throw error;

            form.reset();
            message.textContent =
                'Merci ! Votre avis a été envoyé. Il sera visible après validation.';
        } catch (error) {
            console.error('Erreur lors de l’envoi :', error);
            message.textContent =
                `Erreur : ${error.message || 'Impossible d’envoyer votre avis.'}`;
        } finally {
            button.disabled = false;
        }
    };
}
function renderCart(){let root=document.getElementById('cart-content');if(!root)return;let c=getCart();if(!c.length){root.innerHTML='<p class="muted">Votre panier est encore vide.</p><a class="btn" href="boutique.html">Découvrir la boutique</a>';return}let subtotal=0;root.innerHTML=c.map(x=>{let p=products.find(p=>String(p.id)===String(x.id));if(!p)return '';subtotal+=p.price*x.qty;return `<div class="cart-row"><img src="${escapeHTML(safeImageUrl(p.image))}" alt="${escapeHTML(p.name)}"><div><h3>${escapeHTML(p.name)}</h3><p>${money(p.price)}</p></div><input class="qty" aria-label="Quantité" type="number" min="1" value="${x.qty}" data-id="${p.id}"><button class="remove" data-remove="${p.id}">Retirer</button></div>`}).join('')+`<div class="cart-bottom"><div class="total-box"><div class="total-line"><span>Sous-total</span><b>${money(subtotal)}</b></div><div class="total-line"><span>Livraison</span><span>À confirmer</span></div><a class="btn" href="commande.html">Passer commande</a></div></div>`;root.querySelectorAll('.qty').forEach(el=>el.onchange=()=>{let cart=getCart(),it=cart.find(x=>String(x.id)===el.dataset.id);if(it)it.qty=Math.max(1,Number(el.value)||1);saveCart(cart);renderCart()});root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{saveCart(getCart().filter(x=>String(x.id)!==el.dataset.remove));renderCart()})}

function renderCheckout() {
    const summary = document.getElementById('checkout-summary');
    if (!summary) return;

    const cart = getCart();
    let total = 0;

    summary.innerHTML = '<h3>Votre commande</h3>' +
        cart.map(item => {
            const product = products.find(
                p => String(p.id) === String(item.id)
            );

            if (!product) return '';

            total += product.price * item.qty;

            return `
                <div class="summary-item">
                    <span>${escapeHTML(product.name)} × ${item.qty}</span>
                    <b>${money(product.price * item.qty)}</b>
                </div>
            `;
        }).join('') +
        `<div class="total-line">
            <b>Total</b>
            <b>${money(total)}</b>
        </div>`;

    const form = document.getElementById('checkout-form');

    form.onsubmit = async function(e) {
        e.preventDefault();

        const currentCart = getCart();

        if (!currentCart.length) {
            alert('Votre panier est vide.');
            location.href = 'boutique.html';
            return;
        }

        const data = Object.fromEntries(new FormData(form));

        const articles = currentCart.map(item => ({
            produit_id: String(item.id),
            quantite: Number(item.qty)
        }));

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'Enregistrement...';

        try {
            const { data: result, error } =
                await window.supabaseClient.rpc('creer_commande', {
                    p_nom: `${data.first} ${data.last}`.trim(),
                    p_email: data.email,
                    p_telephone: data.phone,
                    p_adresse: data.address,
                    p_ville: data.city,
                    p_code_postal: data.zip || '',
                    p_mode_paiement: data.payment,
                    p_articles: articles
                });

            if (error) throw error;

            let confirmationEmailSent = false;
            try {
                const { error: emailError } = await window.supabaseClient.functions.invoke(
                    'email-commande',
                    {
                        body: {
                            numero_commande: result.numero_commande,
                            email: data.email
                        }
                    }
                );

                if (emailError) throw emailError;
                confirmationEmailSent = true;
            } catch (emailError) {
                console.error('La commande est enregistrée, mais l’e-mail de confirmation a échoué :', emailError);
            }

            localStorage.setItem('lb-last-order', JSON.stringify({
                number: result.numero_commande,
                total: Number(result.montant_total),
                data: data,
                confirmationEmailSent
            }));

            localStorage.removeItem('lb-cart');

            location.href = 'confirmation.html';

        } catch (error) {
            console.error('Erreur commande :', error);

            alert(
                "La commande n'a pas été enregistrée : " +
                error.message
            );

            button.disabled = false;
            button.textContent = 'Confirmer la commande';
        }
    };
}

function afficherMessageCompte(form, message, erreur = false) {
    let sortie = form.querySelector("[data-auth-message]");
    if (!sortie) {
        sortie = document.createElement("p");
        sortie.dataset.authMessage = "";
        form.appendChild(sortie);
    }
    sortie.textContent = message;
    sortie.setAttribute("role", erreur ? "alert" : "status");
}

function initialiserFormulairesCompte() {
    const client = window.supabaseClient;
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const notice = document.querySelector(".account-grid + .muted.tiny");

    if (notice) {
        notice.textContent = "Un e-mail de confirmation peut être nécessaire avant la première connexion.";
    }

    if (loginForm) {
        const [emailInput, passwordInput] = loginForm.querySelectorAll("input");
        const button = loginForm.querySelector("button");
        button.textContent = "Se connecter";

        loginForm.addEventListener("submit", async event => {
            event.preventDefault();
            button.disabled = true;
            button.textContent = "Connexion...";

            try {
                const { error } = await client.auth.signInWithPassword({
                    email: emailInput.value.trim(),
                    password: passwordInput.value
                });

                if (error) throw error;
                window.location.href = "index.html";
            } catch (error) {
                afficherMessageCompte(loginForm, error.message || "Connexion impossible.", true);
            } finally {
                button.disabled = false;
                button.textContent = "Se connecter";
            }
        });
    }

    if (registerForm) {
        const [nameInput, emailInput, passwordInput] = registerForm.querySelectorAll("input");
        const button = registerForm.querySelector("button");
        button.textContent = "Créer mon compte";

        registerForm.addEventListener("submit", async event => {
            event.preventDefault();
            button.disabled = true;
            button.textContent = "Création...";
            const resendButton = registerForm.querySelector("[data-resend-confirmation]");
            if (resendButton) resendButton.hidden = true;

            try {
                const { data, error } = await client.auth.signUp({
                    email: emailInput.value.trim(),
                    password: passwordInput.value,
                    options: {
                        data: { full_name: nameInput.value.trim() }
                    }
                });

                if (error) throw error;

                const message = data.session
                    ? "Compte créé. Vous pouvez maintenant vous connecter."
                    : "Compte créé. Vérifie aussi les courriers indésirables; tu peux renvoyer le lien si nécessaire.";
                afficherMessageCompte(registerForm, message);
                passwordInput.value = "";

                if (!data.session) {
                    let resend = registerForm.querySelector("[data-resend-confirmation]");
                    if (!resend) {
                        resend = document.createElement("button");
                        resend.type = "button";
                        resend.className = "btn full";
                        resend.dataset.resendConfirmation = "";
                        resend.textContent = "Renvoyer l'e-mail de confirmation";
                        registerForm.appendChild(resend);

                        resend.addEventListener("click", async () => {
                            resend.disabled = true;
                            try {
                                const { error } = await client.auth.resend({
                                    type: "signup",
                                    email: emailInput.value.trim()
                                });
                                if (error) throw error;
                                afficherMessageCompte(registerForm, "Demande de renvoi effectuée. Vérifie ta boîte mail et les courriers indésirables.");
                            } catch (error) {
                                afficherMessageCompte(registerForm, error.message || "Impossible de renvoyer l'e-mail.", true);
                            } finally {
                                resend.disabled = false;
                            }
                        });
                    }
                    resend.hidden = false;
                }
            } catch (error) {
                afficherMessageCompte(registerForm, error.message || "Création du compte impossible.", true);
            } finally {
                button.disabled = false;
                button.textContent = "Créer mon compte";
            }
        });
    }
}

function init(){updateCount();renderProducts();renderProduct();renderCart();renderCheckout();let msg=document.getElementById('confirmation-text'),order=JSON.parse(localStorage.getItem('lb-last-order')||'null');if(msg&&order)msg.textContent=`Votre commande ${order.number} de ${money(order.total)} a bien été enregistrée. Nous vous contacterons pour confirmer la livraison.`;initialiserFormulairesCompte();let toggle=document.querySelector('.menu-toggle');if(toggle){toggle.setAttribute('aria-expanded','false');toggle.onclick=()=>{let nav=document.querySelector('.header nav');if(nav){let open=nav.classList.toggle('mobile-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu')}};document.querySelectorAll('.header nav a').forEach(link=>link.addEventListener('click',()=>{document.querySelector('.header nav')?.classList.remove('mobile-open');toggle.setAttribute('aria-expanded','false')}));window.addEventListener('resize',()=>{if(window.innerWidth>800){document.querySelector('.header nav')?.classList.remove('mobile-open');toggle.setAttribute('aria-expanded','false')}})}}
function ensureSupabase() {
	if (window.supabaseClient) return Promise.resolve();

	return new Promise((resolve, reject) => {
		const loadClient = () => {
			const configScript = document.createElement('script');
			configScript.src = 'js/supabase.js';
			configScript.onload = resolve;
			configScript.onerror = reject;
			document.head.append(configScript);
		};

		if (window.supabase) {
			loadClient();
			return;
		}

		const libraryScript = document.createElement('script');
		libraryScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
		libraryScript.onload = loadClient;
		libraryScript.onerror = reject;
		document.head.append(libraryScript);
	});
}

document.addEventListener('DOMContentLoaded', async () => {
	try {
		await ensureSupabase();
		await loadProducts();
	} catch (error) {
		console.error('Erreur de chargement Supabase :', error);
		alert('Impossible de charger les produits.');
	} finally {
		init();
	}
});