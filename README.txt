LA BOUTIQUE — CODE SOURCE
========================

PAGES PRINCIPALES
- index.html : accueil et accès au suivi des commandes
- boutique.html : catalogue, filtres et tri depuis Supabase
- produit.html : fiche produit et avis clients
- panier.html : panier local du navigateur
- commande.html : formulaire de commande envoyé à la fonction creer_commande
- confirmation.html : confirmation et accès au suivi
- suivi-commande.html : suivi par numéro de commande et e-mail
- compte.html : inscription et connexion Supabase Auth
- admin.html : catalogue, commandes, avis, stock et notifications

CONFIGURATION
1. Servir le dossier avec Live Server ou un serveur HTTP local; ne pas ouvrir les pages directement en file://.
2. Vérifier l'URL et la clé publishable dans js/supabase.js.
3. Exécuter dans Supabase les scripts SQL nécessaires aux fonctions et tables utilisées : suivi de commande, avis, mouvements de stock et notifications.
4. Déployer supabase/functions/email-commande et configurer RESEND_API_KEY ainsi que EMAIL_FROM dans les secrets Supabase pour activer les e-mails de confirmation.
5. Vérifier les règles RLS des tables et fonctions avant toute mise en production.

NOTES
- Les produits, commandes, clients, avis et notifications utilisent Supabase; le panier et le dernier reçu sont conservés dans localStorage.
- Le choix du mode de paiement est enregistré, mais le paiement Mobile Money n'est pas traité automatiquement.
- Le site utilise des images Unsplash et nécessite une connexion Internet.
- La fonction e-mail transactionnel nécessite un expéditeur validé chez Resend.
