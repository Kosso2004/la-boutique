
document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabaseClient;

    if (!supabase) {
        alert("Connexion à Supabase impossible.");
        return;
    }

    const formLogin = document.getElementById("adminLoginForm");

    // CONNEXION ADMINISTRATEUR
    if (formLogin) {
        const message = document.getElementById("message");

        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;

            message.textContent = "Connexion en cours...";

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                message.textContent = error.message;
                return;
            }

            const { data: isAdmin, error: adminError } =
                await supabase.rpc("is_admin");

            if (adminError || !isAdmin) {
                await supabase.auth.signOut();
                message.textContent = "Accès refusé.";
                return;
            }

            window.location.href = "admin.html";
        });

        return;
    }

    // VÉRIFICATION DE L'ADMINISTRATEUR
    if (!document.getElementById("totalProduits")) return;

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
        window.location.href = "admin-login.html";
        return;
    }

    const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_admin");

    if (adminError || !isAdmin) {
        await supabase.auth.signOut();
        window.location.href = "admin-login.html";
        return;
    }

    // DÉCONNEXION
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "admin-login.html";
    });

    // CHARGEMENT DU TABLEAU DE BORD
    await chargerStatistiques();
    await chargerNotifications();
    document.getElementById("rafraichirNotifications")
        ?.addEventListener("click", chargerNotifications);
    const notificationsBell = document.getElementById("notificationsBell");
    const notificationsPanel = document.getElementById("notificationsPanel");
    const fermerNotifications = () => {
        notificationsPanel.hidden = true;
        notificationsBell.setAttribute("aria-expanded", "false");
    };

    notificationsBell.addEventListener("click", async () => {
        notificationsPanel.hidden = !notificationsPanel.hidden;
        notificationsBell.setAttribute("aria-expanded", String(!notificationsPanel.hidden));
        if (!notificationsPanel.hidden) await chargerNotifications();
    });
    document.getElementById("fermerNotifications")
        ?.addEventListener("click", fermerNotifications);
    document.addEventListener("click", event => {
        if (!notificationsPanel.hidden &&
            !notificationsPanel.contains(event.target) &&
            !notificationsBell.contains(event.target)) {
            fermerNotifications();
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !notificationsPanel.hidden) {
            fermerNotifications();
            notificationsBell.focus();
        }
    });
    window.setInterval(chargerNotifications, 60000);
    await chargerProduitsStockFaible();
    await chargerHistoriqueStock();
    await chargerChiffreAffaires();
    await afficherProduits();

let commandesPourFiltre = [];
let avisPourFiltre = [];
await afficherToutesCommandes();
await chargerAvisClients();

document.getElementById("rechercheCommandes")
    ?.addEventListener("input", afficherCommandesFiltrees);
document.getElementById("filtreStatutCommandes")
    ?.addEventListener("change", afficherCommandesFiltrees);
document.getElementById("filtreStatutAvis")
    ?.addEventListener("change", afficherAvisFiltres);

document.getElementById("exporterPDF")
    ?.addEventListener("click", exporterCommandesPDF);

    document.getElementById("periodeVentes")
        ?.addEventListener("change", () => {
            chargerGraphiqueVentes().catch(console.error);
        });
    chargerGraphiqueVentes().catch(console.error);

// AFFICHER TOUTES LES COMMANDES
async function afficherToutesCommandes() {
    const tbody = document.getElementById("toutesCommandes");
    tbody.innerHTML = "<tr><td colspan='6'>Chargement des commandes...</td></tr>";

    const { data: commandes, error } = await supabase
        .from("commandes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6">Erreur de chargement.</td></tr>`;
        return;
    }

    commandesPourFiltre = await Promise.all(commandes.map(async commande => {
        let client = null;

        if (commande.client_id) {
            const result = await supabase
                .from("clients")
                .select("nom, email, telephone")
                .eq("id", commande.client_id)
                .maybeSingle();
            client = result.data;
        }

        return { ...commande, client };
    }));

    afficherCommandesFiltrees();
}

async function chargerAvisClients() {
    const tbody = document.getElementById("listeAvisClients");
    tbody.innerHTML = "<tr><td colspan='7'>Chargement des avis...</td></tr>";

    const { data: avis, error } = await supabase
        .from("avis")
        .select("id, produit_id, nom_client, email_client, note, commentaire, statut, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erreur de chargement des avis :", error);
        tbody.innerHTML = "<tr><td colspan='7'>Impossible de charger les avis.</td></tr>";
        return;
    }

    const produitIds = [...new Set(avis.map(avisClient => avisClient.produit_id).filter(Boolean))];
    const nomsProduits = new Map();

    if (produitIds.length) {
        const { data: produits, error: erreurProduits } = await supabase
            .from("produits")
            .select("id, nom")
            .in("id", produitIds);

        if (erreurProduits) {
            console.error("Erreur de chargement des noms de produits :", erreurProduits);
        } else {
            produits.forEach(produit => nomsProduits.set(String(produit.id), produit.nom));
        }
    }

    avisPourFiltre = avis.map(avisClient => ({
        ...avisClient,
        produitNom: nomsProduits.get(String(avisClient.produit_id)) || "Produit indisponible"
    }));

    afficherAvisFiltres();
}

function afficherAvisFiltres() {
    const tbody = document.getElementById("listeAvisClients");
    const statutChoisi = document.getElementById("filtreStatutAvis").value;
    const avisFiltres = statutChoisi === "tous"
        ? avisPourFiltre
        : avisPourFiltre.filter(avisClient =>
            normaliserTexteFiltre(avisClient.statut) === normaliserTexteFiltre(statutChoisi)
        );

    if (!avisFiltres.length) {
        tbody.innerHTML = avisPourFiltre.length
            ? "<tr><td colspan='7'>Aucun avis pour ce statut.</td></tr>"
            : "<tr><td colspan='7'>Aucun avis envoyé.</td></tr>";
        return;
    }

    tbody.replaceChildren(...avisFiltres.map(avisClient => {
        const ligne = document.createElement("tr");
        const statutAvis = normaliserTexteFiltre(avisClient.statut || "en attente");
        const valeurs = [
            avisClient.created_at
                ? new Date(avisClient.created_at).toLocaleString("fr-FR")
                : "-",
            avisClient.produitNom,
            avisClient.nom_client || "Client anonyme",
            `${Number(avisClient.note)}/5`,
            avisClient.commentaire || "",
            avisClient.statut || "En attente"
        ];

        valeurs.forEach(valeur => {
            const cellule = document.createElement("td");
            cellule.textContent = valeur;
            ligne.appendChild(cellule);
        });

        const actions = document.createElement("td");
        if (statutAvis === "en attente") {
            const approuver = document.createElement("button");
            approuver.type = "button";
            approuver.textContent = "Approuver";
            approuver.addEventListener("click", () => modifierStatutAvis(avisClient.id, "approuvé"));

            const refuser = document.createElement("button");
            refuser.type = "button";
            refuser.textContent = "Refuser";
            refuser.addEventListener("click", () => modifierStatutAvis(avisClient.id, "refusé"));

            actions.append(approuver, document.createTextNode(" "), refuser);
        } else {
            actions.textContent = "-";
        }

        ligne.appendChild(actions);
        return ligne;
    }));
}

async function modifierStatutAvis(avisId, nouveauStatut) {
    const { error } = await supabase
        .from("avis")
        .update({ statut: nouveauStatut })
        .eq("id", avisId);

    if (error) {
        console.error("Erreur de mise à jour de l'avis :", error);
        alert("Impossible de modifier le statut de l'avis : " + error.message);
        return;
    }

    await chargerAvisClients();
}

function normaliserTexteFiltre(valeur) {
    return String(valeur || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function afficherCommandesFiltrees() {
    const tbody = document.getElementById("toutesCommandes");
    const recherche = normaliserTexteFiltre(
        document.getElementById("rechercheCommandes").value
    );
    const statutChoisi = document.getElementById("filtreStatutCommandes").value;
    const statutsFiltres = {
        attente: ["en attente"],
        validee: ["validee", "confirmee"],
        expediee: ["expediee"],
        annulee: ["annulee"]
    };

    const commandesFiltrees = commandesPourFiltre.filter(commande => {
        const correspondRecherche = !recherche || [
            commande.numero_commande,
            commande.client?.nom
        ].some(valeur => normaliserTexteFiltre(valeur).includes(recherche));

        const statutNormalise = normaliserTexteFiltre(commande.statut);
        const correspondStatut = statutChoisi === "tous" ||
            statutsFiltres[statutChoisi]?.includes(statutNormalise);

        return correspondRecherche && correspondStatut;
    });

    if (!commandesFiltrees.length) {
        const message = commandesPourFiltre.length
            ? "Aucune commande ne correspond aux filtres."
            : "Aucune commande enregistrée.";
        tbody.innerHTML = `<tr><td colspan="6">${message}</td></tr>`;
        return;
    }

    tbody.replaceChildren(...commandesFiltrees.map(commande => {
        const ligne = document.createElement("tr");
        const valeurs = [
            commande.numero_commande || "-",
            commande.client?.nom || "Client inconnu",
            Number(commande.montant_total || 0).toLocaleString("fr-FR") + " FCFA",
            commande.statut || "-",
            commande.created_at
                ? new Date(commande.created_at).toLocaleDateString("fr-FR")
                : "-"
        ];

        valeurs.forEach(valeur => {
            const cellule = document.createElement("td");
            cellule.textContent = valeur;
            ligne.appendChild(cellule);
        });

        const actions = document.createElement("td");
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.textContent = "Voir détails";
        bouton.addEventListener("click", () =>
            voirDetailsCommande(commande, commande.client)
        );
        actions.appendChild(bouton);
        ligne.appendChild(actions);

        return ligne;
    }));
}

async function exporterCommandesPDF() {
    const jsPDF = window.jspdf?.jsPDF;

    if (!jsPDF) {
        alert("La bibliothèque PDF n'est pas chargée.");
        return;
    }

    const { data: commandes, error } = await supabase
        .from("commandes")
        .select("id, client_id, numero_commande, montant_total, statut, mode_paiement, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        alert("Erreur lors du chargement des commandes.");
        console.error(error);
        return;
    }

    if (!commandes || commandes.length === 0) {
        alert("Aucune commande à exporter.");
        return;
    }

    const lignes = await Promise.all(
        commandes.map(async commande => {
            let nomClient = "Client inconnu";

            if (commande.client_id) {
                const { data: client } = await supabase
                    .from("clients")
                    .select("nom")
                    .eq("id", commande.client_id)
                    .maybeSingle();

                if (client) nomClient = client.nom;
            }

            return [
                commande.numero_commande || commande.id,
                nomClient,
                new Date(commande.created_at).toLocaleDateString("fr-FR"),
                Number(commande.montant_total || 0).toLocaleString("fr-FR") + " FCFA",
                commande.statut || "",
                commande.mode_paiement || ""
            ];
        })
    );

    const pdf = new jsPDF({ orientation: "landscape" });

    if (typeof pdf.autoTable !== "function") {
        alert("Le module de tableau PDF n'est pas chargé.");
        return;
    }

    pdf.setFontSize(18);
    pdf.text("LA BOUTIQUE", 14, 15);

    pdf.setFontSize(11);
    pdf.text("Liste des commandes", 14, 23);

    pdf.autoTable({
        startY: 30,
        head: [[
            "N° Commande",
            "Client",
            "Date",
            "Montant",
            "Statut",
            "Paiement"
        ]],
        body: lignes,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: {
            fillColor: [198, 155, 101]
        }
    });

    pdf.save("commandes_la_boutique.pdf");
}

    // CONSULTER LES DÉTAILS D'UNE COMMANDE
    async function voirDetailsCommande(commande, client) {
        const popup = document.getElementById("popupCommande");
        const details = document.getElementById("detailsCommande");

        popup.classList.add("active");
        details.textContent = "Chargement des détails...";

        const { data: lignes, error } = await supabase
            .from("lignes_commande")
            .select("*")
            .eq("commande_id", commande.id);

        if (error) {
            details.textContent = "Impossible de charger les produits commandés.";
            console.error(error);
            return;
        }

        details.innerHTML = "";

        const titre = document.createElement("h3");
        titre.textContent = "Commande " + (commande.numero_commande || "");
        details.appendChild(titre);

        const infos = document.createElement("p");
        infos.textContent =
            "Client : " + (client?.nom || "Inconnu") +
            " | E-mail : " + (client?.email || "-") +
            " | Téléphone : " + (client?.telephone || "-");
        details.appendChild(infos);

        const adresse = document.createElement("p");
        adresse.textContent = "Adresse de livraison : " +
            (commande.adresse_livraison || "-");
        details.appendChild(adresse);

        const paiement = document.createElement("p");
        paiement.textContent = "Paiement : " + (commande.mode_paiement || "-");
        details.appendChild(paiement);

        const tableau = document.createElement("table");
        tableau.innerHTML = `
            <thead>
                <tr>
                    <th>Produit</th>
                    <th>Quantité</th>
                    <th>Prix unitaire</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const corps = tableau.querySelector("tbody");

        for (const ligne of (lignes || [])) {
            const { data: produit } = await supabase
                .from("produits")
                .select("nom")
                .eq("id", ligne.produit_id)
                .maybeSingle();

            const tr = document.createElement("tr");

            [
                produit?.nom || "Produit indisponible",
                ligne.quantite,
                Number(ligne.prix_unitaire).toLocaleString("fr-FR") + " FCFA"
            ].forEach(valeur => {
                const td = document.createElement("td");
                td.textContent = valeur;
                tr.appendChild(td);
            });

            corps.appendChild(tr);
        }

        details.appendChild(tableau);

        const total = document.createElement("h3");
        total.textContent = "Total : " +
            Number(commande.montant_total).toLocaleString("fr-FR") + " FCFA";
        details.appendChild(total);

        const label = document.createElement("label");
        label.textContent = "Modifier le statut : ";

        const select = document.createElement("select");

        ["En attente", "Confirmée", "Expédiée", "Livrée", "Annulée"]
            .forEach(statut => {
                const option = document.createElement("option");
                option.value = statut;
                option.textContent = statut;
                select.appendChild(option);
            });

        select.value = commande.statut || "En attente";

        const boutonStatut = document.createElement("button");
        boutonStatut.textContent = "Enregistrer le statut";
        boutonStatut.type = "button";

        boutonStatut.addEventListener("click", async () => {
            boutonStatut.disabled = true;

            const { error } = await supabase
                .from("commandes")
                .update({ statut: select.value })
                .eq("id", commande.id);

            boutonStatut.disabled = false;

            if (error) {
                alert("Erreur : " + error.message);
                return;
            }

            alert("Statut mis à jour !");
            fermerPopupCommande();
            await afficherToutesCommandes();
        });

        details.appendChild(document.createElement("br"));
        details.appendChild(label);
        details.appendChild(select);
        details.appendChild(document.createElement("br"));
        details.appendChild(boutonStatut);
    }

function fermerPopupCommande() {
    document.getElementById("popupCommande").classList.remove("active");
}

document.getElementById("fermerCommande")
    .addEventListener("click", fermerPopupCommande);

document.getElementById("popupCommande").addEventListener("click", e => {
    if (e.target.id === "popupCommande") {
        fermerPopupCommande();
    }
});

    // STATISTIQUES
    async function chargerStatistiques() {
        const tables = [
            ["produits", "totalProduits"],
            ["commandes", "totalCommandes"],
            ["clients", "totalClients"]
        ];

        for (const [table, element] of tables) {
            const { count, error } = await supabase
                .from(table)
                .select("*", { count: "exact", head: true });

            document.getElementById(element).textContent =
                error ? "Erreur" : count;
        }
    }

    async function chargerNotifications() {
        const liste = document.getElementById("notificationsListe");
        const panelListe = document.getElementById("notificationsPanelListe");
        const compteur = document.getElementById("notificationsNonLues");
        if (!liste || !compteur) return;

        const { data, error } = await supabase
            .from("notifications")
            .select("id, type, titre, message, lue, created_at")
            .order("created_at", { ascending: false })
            .limit(30);

        if (error) {
            console.error("Erreur de chargement des notifications :", error);
            compteur.textContent = "Notifications indisponibles";
            liste.textContent = "Exécute le fichier supabase-notifications.sql dans Supabase.";
            if (panelListe) panelListe.textContent = "Notifications indisponibles.";
            return;
        }

        const nonLues = data.filter(notification => !notification.lue).length;
        compteur.textContent = `${nonLues} notification${nonLues === 1 ? "" : "s"} non lue${nonLues === 1 ? "" : "s"}`;
        const badge = document.getElementById("notificationsBadge");
        const cloche = document.getElementById("notificationsBell");
        if (badge) {
            badge.textContent = nonLues > 99 ? "99+" : String(nonLues);
            badge.hidden = nonLues === 0;
        }
        if (cloche) {
            cloche.setAttribute("aria-label", `${nonLues} notification${nonLues === 1 ? "" : "s"} non lue${nonLues === 1 ? "" : "s"}`);
        }

        if (!data.length) {
            liste.innerHTML = "<p class='muted'>Aucune notification.</p>";
            if (panelListe) panelListe.innerHTML = "<p class='muted'>Aucune notification.</p>";
            return;
        }

        const construireNotifications = () => data.map(notification => {
            const article = document.createElement("article");
            article.className = notification.lue
                ? "notification-item"
                : "notification-item notification-unread";

            const contenu = document.createElement("div");
            const titre = document.createElement("strong");
            titre.textContent = notification.titre;
            const message = document.createElement("p");
            message.textContent = notification.message;
            const date = document.createElement("small");
            date.textContent = new Date(notification.created_at).toLocaleString("fr-FR");
            contenu.append(titre, message, date);
            article.appendChild(contenu);

            if (!notification.lue) {
                const bouton = document.createElement("button");
                bouton.type = "button";
                bouton.textContent = "Marquer comme lue";
                bouton.addEventListener("click", async () => {
                    bouton.disabled = true;
                    const { error: updateError } = await supabase
                        .from("notifications")
                        .update({ lue: true })
                        .eq("id", notification.id);

                    if (updateError) {
                        console.error("Erreur de mise à jour notification :", updateError);
                        bouton.disabled = false;
                        return;
                    }

                    await chargerNotifications();
                });
                article.appendChild(bouton);
            }

            return article;
        });

        liste.replaceChildren(...construireNotifications());
        if (panelListe) panelListe.replaceChildren(...construireNotifications());
    }

    async function chargerProduitsStockFaible() {
        const tbody = document.getElementById("listeProduitsStockFaible");
        const { data, error } = await supabase
            .from("produits")
            .select("id, nom, stock")
            .eq("actif", true)
            .order("stock", { ascending: true });

        if (error) {
            console.error("Erreur de chargement du stock :", error);
            tbody.innerHTML = "<tr><td colspan='3'>Erreur de chargement.</td></tr>";
            return;
        }

        const produitsFaibles = data.filter(produit =>
            Number(produit.stock) <= 5
        );

        document.getElementById("produitsStockFaible").textContent =
            produitsFaibles.length;

        if (produitsFaibles.length === 0) {
            tbody.innerHTML = "<tr><td colspan='3'>Aucun produit en stock faible.</td></tr>";
            return;
        }

        tbody.replaceChildren(...produitsFaibles.map(produit => {
            const ligne = document.createElement("tr");
            const nom = document.createElement("td");
            const stock = document.createElement("td");
            const actions = document.createElement("td");
            const bouton = document.createElement("button");

            nom.textContent = produit.nom || "Produit sans nom";
            stock.textContent = produit.stock ?? 0;
            bouton.type = "button";
            bouton.textContent = "Modifier le stock";
            bouton.addEventListener("click", async () => {
                const saisie = window.prompt(
                    `Nouvelle quantité pour ${produit.nom || "ce produit"} :`,
                    String(produit.stock ?? 0)
                );

                if (saisie === null) return;

                const nouveauStock = Number(saisie);
                if (!saisie.trim() || !Number.isInteger(nouveauStock) || nouveauStock < 0) {
                    alert("Saisis un nombre entier supérieur ou égal à 0.");
                    return;
                }

                bouton.disabled = true;
                const { error: updateError } = await supabase
                    .from("produits")
                    .update({ stock: nouveauStock })
                    .eq("id", produit.id);

                if (updateError) {
                    console.error("Erreur de mise à jour du stock :", updateError);
                    alert("Impossible de modifier le stock : " + updateError.message);
                    bouton.disabled = false;
                    return;
                }

                await chargerProduitsStockFaible();
            });

            actions.appendChild(bouton);
            ligne.append(nom, stock, actions);
            return ligne;
        }));
    }

    async function chargerHistoriqueStock() {
        const tbody = document.getElementById("historiqueStock");
        const { data, error } = await supabase
            .from("mouvements_stock")
            .select("produit_nom, type, quantite, stock_avant, stock_apres, created_at")
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) {
            console.error("Erreur de chargement de l'historique du stock :", error);
            tbody.innerHTML = "<tr><td colspan='6'>Historique indisponible. Exécute le fichier supabase-mouvements-stock.sql dans Supabase.</td></tr>";
            return;
        }

        if (!data.length) {
            tbody.innerHTML = "<tr><td colspan='6'>Aucun mouvement enregistré pour le moment.</td></tr>";
            return;
        }

        const libelles = {
            ajout: "Ajout du produit",
            diminution: "Diminution",
            reapprovisionnement: "Réapprovisionnement"
        };

        tbody.replaceChildren(...data.map(mouvement => {
            const ligne = document.createElement("tr");
            const quantite = Number(mouvement.quantite || 0);
            const valeurs = [
                new Date(mouvement.created_at).toLocaleString("fr-FR"),
                mouvement.produit_nom,
                libelles[mouvement.type] || mouvement.type,
                mouvement.type === "diminution" ? `-${quantite}` : `+${quantite}`,
                mouvement.stock_avant,
                mouvement.stock_apres
            ];

            valeurs.forEach(valeur => {
                const cellule = document.createElement("td");
                cellule.textContent = valeur ?? "-";
                ligne.appendChild(cellule);
            });

            return ligne;
        }));
    }

    // CHIFFRE D'AFFAIRES ET COMMANDES EN ATTENTE
    async function chargerChiffreAffaires() {
        const { data, error } = await supabase
            .from("commandes")
            .select("montant_total, statut");

        if (error) {
            console.error(error);
            return;
        }

        const commandesValides = data.filter(c =>
            (c.statut || "").toLowerCase() !== "annulée" &&
            (c.statut || "").toLowerCase() !== "annulee"
        );

        const total = commandesValides.reduce(
            (somme, c) => somme + Number(c.montant_total || 0), 0
        );

        document.getElementById("chiffreAffaires").textContent =
            total.toLocaleString("fr-FR") + " FCFA";

        const attente = data.filter(c =>
            (c.statut || "").toLowerCase() === "en attente"
        ).length;

        document.getElementById("commandesAttente").textContent = attente;
    }

    // GRAPHIQUE DES VENTES PAR PÉRIODE
    async function chargerGraphiqueVentes() {
        const periode = document.getElementById("periodeVentes")?.value || "semaine";

        const aujourdHui = new Date();
        aujourdHui.setHours(0, 0, 0, 0);

        let debut = new Date(aujourdHui);
        let dates = [];

        if (periode === "jour") {
            dates = [new Date(aujourdHui)];
        } else if (periode === "semaine") {
            const jour = debut.getDay();
            const decalage = jour === 0 ? 6 : jour - 1;
            debut.setDate(debut.getDate() - decalage);

            for (let date = new Date(debut); date <= aujourdHui; date.setDate(date.getDate() + 1)) {
                dates.push(new Date(date));
            }
        } else if (periode === "mois") {
            debut = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), 1);

            for (let date = new Date(debut); date <= aujourdHui; date.setDate(date.getDate() + 1)) {
                dates.push(new Date(date));
            }
        } else if (periode === "annee") {
            debut = new Date(aujourdHui.getFullYear(), 0, 1);

            for (let mois = 0; mois <= aujourdHui.getMonth(); mois++) {
                dates.push(new Date(aujourdHui.getFullYear(), mois, 1));
            }
        }

        const dateCle = date => {
            const annee = date.getFullYear();
            const mois = String(date.getMonth() + 1).padStart(2, "0");
            const jour = String(date.getDate()).padStart(2, "0");
            return `${annee}-${mois}-${jour}`;
        };

        const { data, error } = await supabase
            .from("commandes")
            .select("montant_total, statut, created_at")
            .gte("created_at", debut.toISOString());

        if (error) {
            console.error(error);
            return;
        }

        const ventes = dates.map(date => ({
            cle: periode === "annee"
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
                : dateCle(date),
            label: periode === "annee"
                ? date.toLocaleDateString("fr-FR", { month: "short" })
                : periode === "mois"
                    ? String(date.getDate())
                    : date.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit"
                    }),
            total: 0
        }));

        data.forEach(commande => {
            const statut = (commande.statut || "").toLowerCase();

            if (statut === "annulée" || statut === "annulee") return;

            const dateCommande = new Date(commande.created_at);
            const cle = periode === "annee"
                ? `${dateCommande.getFullYear()}-${String(dateCommande.getMonth() + 1).padStart(2, "0")}`
                : dateCle(dateCommande);

            const vente = ventes.find(item => item.cle === cle);

            if (vente) {
                vente.total += Number(commande.montant_total || 0);
            }
        });

        const canvas = document.getElementById("graphiqueVentes");

        if (!canvas) return;
        if (typeof Chart === "undefined") {
            console.error("Chart.js n'est pas chargé.");
            return;
        }

        if (window.graphiqueBoutique) {
            window.graphiqueBoutique.destroy();
        }

        window.graphiqueBoutique = new Chart(canvas, {
            type: "bar",
            data: {
                labels: ventes.map(vente => vente.label),
                datasets: [{
                    label: "Ventes en FCFA",
                    data: ventes.map(vente => vente.total),
                    backgroundColor: "#c69b65",
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // PROTECTION DES TEXTES AFFICHÉS
    function echapper(valeur) {
        return String(valeur).replace(/[&<>"']/g, caractere => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[caractere]);
    }

    // AFFICHER LES PRODUITS
    async function afficherProduits() {
        const tbody = document.getElementById("listeProduits");

        const { data, error } = await supabase
            .from("produits")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            tbody.innerHTML = "<tr><td colspan='5'>Erreur de chargement des produits.</td></tr>";
            console.error(error);
            return;
        }

        if (!data.length) {
            tbody.innerHTML = "<tr><td colspan='5'>Aucun produit enregistré.</td></tr>";
            return;
        }

        tbody.innerHTML = data.map(p => `
            <tr>
                <td>
                    ${p.image_url
                        ? `<img src="${echapper(p.image_url)}" alt="" width="55">`
                        : "-"}
                </td>
                <td>${echapper(p.nom)}</td>
                <td>${Number(p.prix).toLocaleString("fr-FR")} FCFA</td>
                <td>${p.stock}</td>
                <td>
                    <button type="button" data-edit="${p.id}">Modifier</button>
                    <button type="button" data-delete="${p.id}">Supprimer</button>
                </td>
            </tr>
        `).join("");
    }

    const produitForm = document.getElementById("produitForm");
    const messageProduit = document.getElementById("messageProduit");

// OUVRIR LE POPUP
const popup = document.getElementById("popupProduit");

document.getElementById("ouvrirPopup").addEventListener("click", () => {
    produitForm.reset();
    document.getElementById("produitId").value = "";
    document.getElementById("formTitre").textContent = "Ajouter un produit";
    document.getElementById("btnProduit").textContent = "Enregistrer le produit";
    document.getElementById("annulerModification").style.display = "inline-block";
    messageProduit.textContent = "";
    popup.classList.add("active");
});

// FERMER LE POPUP
function fermerFenetreProduit() {
    popup.classList.remove("active");
}

        fermerFenetreProduit();
document.getElementById("fermerPopup").addEventListener("click", fermerFenetreProduit);

document.getElementById("annulerModification").addEventListener("click", () => {
    produitForm.reset();
    document.getElementById("produitId").value = "";
    fermerFenetreProduit();
});

// Fermer en cliquant sur l'arrière-plan
popup.addEventListener("click", (e) => {
    if (e.target === popup) {
        fermerFenetreProduit();
    }
});

    // AJOUTER OU MODIFIER UN PRODUIT
    produitForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = document.getElementById("produitId").value;

        const produit = {
            nom: document.getElementById("nomProduit").value.trim(),
            description: document.getElementById("descriptionProduit").value.trim(),
            prix: Number(document.getElementById("prixProduit").value),
            categorie: document.getElementById("categorieProduit").value,
            image_url: document.getElementById("imageProduit").value.trim() || null,
            stock: Number(document.getElementById("stockProduit").value),
            actif: true
        };

        if (!produit.nom || produit.prix < 0 || produit.stock < 0) {
            messageProduit.textContent = "Vérifie les informations saisies.";
            return;
        }

        let resultat;

        if (id) {
            resultat = await supabase
                .from("produits")
                .update(produit)
                .eq("id", id);
        } else {
            resultat = await supabase
                .from("produits")
                .insert(produit);
        }

        if (resultat.error) {
            messageProduit.textContent = "Erreur : " + resultat.error.message;
            console.error(resultat.error);
            return;
        }

        messageProduit.textContent = id
            ? "Produit modifié avec succès !"
            : "Produit ajouté avec succès !";

        produitForm.reset();
        document.getElementById("produitId").value = "";
        document.getElementById("formTitre").textContent = "Ajouter un produit";
        document.getElementById("btnProduit").textContent = "Ajouter le produit";
        document.getElementById("annulerModification").style.display = "none";

        await afficherProduits();
        await chargerStatistiques();
    });

    // MODIFIER OU SUPPRIMER
    document.getElementById("listeProduits").addEventListener("click", async (e) => {
        const idModification = e.target.dataset.edit;
        const idSuppression = e.target.dataset.delete;

        if (idModification) {
            const { data, error } = await supabase
                .from("produits")
                .select("*")
                .eq("id", idModification)
                .single();

            if (error) {
                alert("Impossible de récupérer le produit.");
                return;
            }

            document.getElementById("produitId").value = data.id;
            document.getElementById("nomProduit").value = data.nom;
            document.getElementById("descriptionProduit").value = data.description || "";
            document.getElementById("prixProduit").value = data.prix;
            document.getElementById("categorieProduit").value = data.categorie;
            document.getElementById("imageProduit").value = data.image_url || "";
            document.getElementById("stockProduit").value = data.stock;

            document.getElementById("formTitre").textContent = "Modifier le produit";
            document.getElementById("btnProduit").textContent = "Enregistrer les modifications";
            document.getElementById("annulerModification").style.display = "inline-block";
                popup.classList.add("active");

            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        if (idSuppression) {
            if (!confirm("Veux-tu vraiment supprimer ce produit ?")) return;

            const { error } = await supabase
                .from("produits")
                .delete()
                .eq("id", idSuppression);

            if (error) {
                alert("Erreur : " + error.message);
                return;
            }

            alert("Produit supprimé !");
            await afficherProduits();
            await chargerStatistiques();
        }
    });

    // ANNULER UNE MODIFICATION
    document.getElementById("annulerModification").addEventListener("click", () => {
        produitForm.reset();
        document.getElementById("produitId").value = "";
        document.getElementById("formTitre").textContent = "Ajouter un produit";
        document.getElementById("btnProduit").textContent = "Ajouter le produit";
        document.getElementById("annulerModification").style.display = "none";
        messageProduit.textContent = "";
    });
});
