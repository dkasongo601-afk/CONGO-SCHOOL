CONGO SCHOOL — Gestion scolaire connectée
Version 2.0 — authentification Supabase et synchronisation cloud

FONCTIONS
- Création de compte en ligne : nom complet, e-mail, téléphone, nom de l'école et mot de passe.
- Connexion et déconnexion via Supabase Auth.
- Synchronisation des élèves, paiements, paramètres et informations de l'école entre appareils qui utilisent le même compte.
- Les données cloud sont isolées par utilisateur grâce à une politique Row Level Security.

INSTALLATION OBLIGATOIRE DE LA BASE EN LIGNE
1. Ouvrez https://supabase.com/dashboard et choisissez le projet CONGO SCHOOL.
2. Ouvrez SQL Editor > New query.
3. Ouvrez SUPABASE-SETUP.sql, copiez tout son contenu dans SQL Editor et cliquez Run.
4. Dans Authentication > Providers > Email, configurez la confirmation d'e-mail selon votre choix. Si la confirmation est activée, l'utilisateur doit cliquer sur le lien reçu par e-mail avant de se connecter.
5. Ouvrez index.html dans l'application ou lancez npm start depuis le dossier du projet. Une connexion Internet est nécessaire.

COMPTE SUR PLUSIEURS APPAREILS
Connectez-vous avec la même adresse e-mail et le même mot de passe sur chaque appareil. Les données sont partagées par ce même compte. Les comptes différents ont chacun leurs propres données.

IMPORTANT
- Cette application utilise une clé Supabase publishable (publique), jamais une clé service_role.
- Ne publiez jamais de clé secrète/service_role.
- L'ancienne inscription locale n'est pas automatiquement un compte Supabase : créez un compte dans la nouvelle page de connexion. Le mot de passe n'est pas migré.
- Le logo personnalisé est actuellement conservé dans les données cloud sous forme de données intégrées ; pour de gros logos, un stockage Supabase Storage séparé serait préférable.
- Testez avant d'utiliser des données personnelles réelles d'élèves. Prévoyez des sauvegardes et vérifiez vos paramètres d'authentification.
- Le CDN Supabase nécessite une connexion Internet.
