# Centr QG

Campus 3D d'organisation : chaque activité est un bâtiment qui s'ouvre sur ses **tâches**, son **agenda**, ses **notes** et son **schéma vision / stratégie**. Le bouton **Aujourd'hui** regroupe toute la journée.

- `index.html` : toute l'application (un seul fichier, aucune installation).
- `apps-script/Code.gs` : le script Google qui sert de base de données (Google Sheets) et de pont vers Google Agenda.

Sans connexion Google, l'app marche quand même : les données restent dans le navigateur.

---

## 1. Mettre en ligne (GitHub + Vercel)

1. Crée un dépôt GitHub (ex. `centr-qg`) et envoies-y `index.html`, `README.md` et le dossier `apps-script/`.
2. Sur vercel.com : **Add New → Project**, importe le dépôt, garde les réglages par défaut (pas de framework), **Deploy**.
3. Ton QG est en ligne sur l'adresse Vercel. Chaque push sur GitHub le met à jour.

## 2. Créer la base Google Sheets (10 min, une seule fois)

1. Crée un Google Sheets vide, nomme-le **Centr QG**.
2. Menu **Extensions → Apps Script**. Efface le contenu, colle tout le fichier `apps-script/Code.gs`, enregistre (💾).
3. **Paramètres du projet** (roue dentée à gauche) → Fuseau horaire : **Europe/Paris**.
4. Dans la barre du haut, choisis la fonction **setup** puis clique **Exécuter**. Google demande des autorisations (Sheets + Agenda) : accepte. Si un écran « Application non validée » apparaît : *Paramètres avancés → Accéder à Centr QG (non sécurisé)* — c'est ton propre script.
5. Ouvre le **Journal d'exécution** : copie le **code secret** affiché.
6. **Déployer → Nouveau déploiement** → type **Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
   - **Déployer**, puis copie l'**URL** qui finit par `/exec`.
7. Ouvre ton Centr QG (Vercel) → **⚙ Réglages** → colle l'URL et le code secret → **Tester la connexion** → **Enregistrer et connecter**.

Fais l'étape 7 une fois sur chaque appareil (ordi, téléphone).

### Ce que tu obtiens dans le Sheets
- Onglet **spaces** : la base technique (ne pas modifier à la main).
- Onglets **Tâches** et **Agenda** : une vue lisible, mise à jour à chaque modification (pratique pour filtrer, imprimer, partager à Reda).

### Google Agenda
- Tes rendez-vous Google s'affichent en gris dans l'agenda de chaque bâtiment et dans **Aujourd'hui**. « Planifier dans l'agenda » évite ces créneaux.
- Un créneau créé dans Centr QG avec **« Aussi dans Google Agenda »** coché est créé dans ton Google Agenda, préfixé par l'activité (ex. `[Ecom] Créas Meta`). Le modifier ou le supprimer dans Centr QG le modifie aussi dans Google.

## 3. Récupérer les données de la version Claude

Dans la version Claude : **⚙ Réglages → Copier mes données**. Dans la version Vercel connectée : colle dans la zone **Importer** → **Importer**.

## Sécurité
- L'URL du script et le code secret donnent accès à tes données : ne les publie pas (ils ne sont **pas** dans le code, seulement dans ton navigateur).
- Si le code secret fuite : dans Apps Script → Paramètres du projet → Propriétés du script → change `TOKEN`, puis recolle-le dans les réglages.
- Si tu modifies `Code.gs` plus tard : **Déployer → Gérer les déploiements → ✏️ → Nouvelle version** (l'URL reste la même).
