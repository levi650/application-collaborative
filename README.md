# 📊 GradeSync – Application Collaborative de Gestion des Notes

Application web temps réel de gestion des notes scolaires avec gestion des rôles, synchronisation bidirectionnelle par WebSocket, détection de conflits (verrouillage optimiste) et traçabilité complète des modifications (audit log & annulation).

---

## 🚀 Installation et Lancement

### Prérequis
- **Node.js** (v18 ou supérieur recommandé)
- **npm** (inclus avec Node.js)

### Installation des dépendances
```bash
npm install
```

### Démarrage de l'application
Pour lancer à la fois le serveur backend et le client frontend :
```bash
npm run dev
```
- **Backend API & WebSocket** : [http://localhost:3001](http://localhost:3001)
- **Frontend Vite + React** : [http://localhost:5173](http://localhost:5173)

### Exécution des tests automatisés
Pour lancer la suite de tests (vitest + supertest) :
```bash
npm test
```

### Build de production
```bash
npm run build
```

---

## 👥 Comptes de Test

Les sessions sont isolées via `sessionStorage`, ce qui permet d'utiliser plusieurs comptes différents simultanément dans plusieurs onglets ou fenêtres.

| Rôle | Nom affiché | Email | Mot de passe | Permissions |
|---|---|---|---|---|
| **ADMIN** | Admin Principal | `admin@test.com` | `admin123` | Accès complet (CRUD notes, suppression, gestion utilisateurs) |
| **TEACHER** | Fatima Zahra Mansouri | `teacher1@test.com` | `teacher123` | Lecture de toutes les notes, modification, ajout, annulation |
| **TEACHER** | Mehdi Alami | `teacher2@test.com` | `teacher123` | Lecture de toutes les notes, modification, ajout, annulation |
| **STUDENT** | Yassine El Amrani | `student1@test.com` | `student123` | Consultation stricte de ses propres notes uniquement |

### Étudiants enregistrés (Noms arabes marocains)
- **Yassine El Amrani** (associé au compte `student1@test.com`)
- **Salma Benjelloun**
- **Omar Idrissi**

### Modules d'enseignement (Informatique)
- Algorithmique
- Bases de données
- Programmation Web
- Réseaux informatiques
- Systèmes d'exploitation

---

## 🧪 Protocole de Test avec Deux Navigateurs (Scénario de Conflit)

Pour reproduire et tester la détection de conflit en conditions réelles :

1. **Ouvrir deux fenêtres de navigateur :**
   - Fenêtre 1 : Navigateur normal (ex. Chrome) sur [http://localhost:5173](http://localhost:5173)
   - Fenêtre 2 : Fenêtre de navigation privée (ou un second navigateur comme Firefox/Edge) sur [http://localhost:5173](http://localhost:5173)

2. **Connexion :**
   - Fenêtre 1 : Connectez-vous avec `teacher1@test.com` / `teacher123` (Enseignant A - Fatima Zahra Mansouri).
   - Fenêtre 2 : Connectez-vous avec `teacher2@test.com` / `teacher123` (Enseignant B - Mehdi Alami).

3. **Étape 1 – Consultation initiale :**
   - Sélectionnez l'étudiant **Yassine El Amrani**.
   - Constatez que la note de **Algorithmique** est à **12/20** (version `v4`) sur les deux fenêtres.

4. **Étape 2 – Modification par l'Enseignant A :**
   - Sur la Fenêtre 1, cliquez sur l'icône crayon ✏️ pour Algorithmique.
   - Modifiez la note de **12** à **16**, puis validez.
   - La note passe à **16/20** en `v5`.
   - **Observez la Fenêtre 2** : la note se met à jour instantanément en temps réel grâce au WebSocket, accompagnée d'une notification toast ("Modifié par Fatima Zahra Mansouri...").

5. **Étape 3 – Tentative de modification en conflit par l'Enseignant B :**
   - Sur la Fenêtre 2 (ou en gardant l'éditeur ouvert avec la version précédente `v4`), essayez de soumettre la note **14** avec la version attendue 4.
   - Le serveur rejette la requête avec le code **HTTP 409 (Conflict)**.
   - L'écran modal de résolution de conflit s'affiche instantanément :
     - **Votre modification** : 14/20 (v4 envoyée)
     - **Version du serveur** : 16/20 (v5 par Fatima Zahra Mansouri)
   - Aucune écrasement silencieux n'est permis.

6. **Étape 4 – Choix de l'Enseignant B :**
   - **Option A** : Cliquer sur *"Conserver la version du serveur"* pour abandonner sa modification et garder 16/20.
   - **Option B** : Proposer une nouvelle note (ex: 14/20 ou 15/20) basée sur la version actuelle `v5`. La note passera alors en `v6`.

7. **Étape 5 – Consultation de l'historique et Annulation :**
   - Cliquez sur l'icône 📋 (Historique) de la note.
   - Toutes les versions sont listées par ordre chronologique avec l'auteur, l'ancienne et la nouvelle valeur, l'horodatage et la version.
   - Cliquez sur *"Annuler la dernière modification"* : une nouvelle version (`v7`) de type `UNDO` est créée, rétablissant la valeur précédente sans jamais effacer l'historique existant.

---

## 🏛️ Architecture Technique

```
Application collaborative/
├── server/
│   ├── index.js          # Serveur Express + WebSocket (ws), authentification HMAC, CRUD & verrouillage optimiste
│   └── data.json         # Persistance fichier JSON (étudiants, utilisateurs, notes, auditLog)
├── src/
│   ├── auth/
│   │   ├── AuthProvider.jsx    # Contexte d'authentification (sessionStorage, token, login/logout)
│   │   └── ProtectedRoute.jsx  # Garde de routes avec contrôle d'accès selon le rôle
│   ├── features/grades/
│   │   ├── ConflictResolver.jsx # Interface interactive de résolution de conflit (HTTP 409)
│   │   ├── GradeEditor.jsx      # Modal d'édition des notes
│   │   └── GradeHistory.jsx     # Visualiseur d'audit log chronologique & bouton Annuler
│   ├── hooks/
│   │   ├── useGradeMutation.js  # Hook de mutation avec gestion automatique de l'erreur 409
│   │   └── useRealtimeGrades.js # Hook d'abonnement WebSocket avec reconnexion automatique
│   ├── pages/
│   │   ├── GradesPage.jsx       # Page principale de consultation/gestion des notes
│   │   └── LoginPage.jsx        # Page de connexion avec redirection déclarative
│   ├── services/
│   │   ├── api.js               # Client HTTP REST (fetch avec en-têtes Authorization)
│   │   └── realtime.js          # Client WebSocket résilient (backoff exponentiel)
│   ├── index.css                # Design system moderne (CSS natif, palette sobre, mode sombre/clair)
│   ├── App.jsx                  # Configuration du routeur React Router
│   └── main.jsx                 # Point d'entrée React 19
├── tests/
│   └── scenario.test.js         # 15 tests automatisés (sécurité des rôles, scénario TP, WebSocket)
└── package.json
```

---

## 🔒 Stratégie de Résolution des Conflits (Optimistic Locking)

L'application utilise le **verrouillage optimiste** (optimistic concurrency control) basé sur un numéro de version incrémental :

1. **Numérotation des versions** :
   - Chaque note possède un entier `version` (initialisé à 1, incrémenté à chaque modification).
2. **Transmission de la version attendue** :
   - Lorsqu'un utilisateur soumet une mise à jour (`PUT /api/grades/:id`), le client transmet le champ `expectedVersion` égal à la version dont il dispose localement.
3. **Vérification côté serveur** :
   - Si `expectedVersion === grade.version` : la modification est acceptée, la note prend la nouvelle valeur, la version est incrémentée (`version + 1`), un événement d'audit est enregistré, et l'événement WebSocket est diffusé.
   - Si `expectedVersion !== grade.version` : le serveur refuse la modification et répond avec le code HTTP **409 Conflict**. Le payload contient la valeur courante, la version courante, le dernier auteur et la date de modification.
4. **Arbitrage par l'utilisateur** :
   - Le frontend affiche le composant `ConflictResolver` présentant côte-à-côte les deux versions. L'utilisateur a le choix souverain de conserver la version du serveur ou de re-soumettre une modification calculée à partir de la version fraîche.

---

## 🛡️ Sécurité des Rôles (RBAC côté Serveur)

La sécurité est strictement assurée côté serveur :
- **Token JWT / HMAC** obligatoire pour tout appel aux routes `/api/*` (hors `/api/login` et `/api/reset`). Sans token valide : `401 Unauthorized`.
- **Rôle STUDENT** :
  - Ne peut modifier aucune note : `PUT /api/grades/:id` renvoie `403 Forbidden`.
  - Ne peut créer aucune note : `POST /api/grades` renvoie `403 Forbidden`.
  - Ne peut consulter que ses propres notes : le filtrage s'applique automatiquement côté serveur via son `userId`.
- **Rôle TEACHER** :
  - Peut consulter toutes les notes, en ajouter, les modifier et annuler des modifications.
  - Ne peut pas supprimer de note (`DELETE /api/grades/:id` réservé à l'ADMIN -> `403`).
  - Ne peut pas supprimer d'étudiant (`DELETE /api/students/:id` réservé à l'ADMIN -> `403`).
  - Ne peut pas accéder à la liste des utilisateurs (`GET /api/users` réservé à l'ADMIN -> `403`).
- **Rôle ADMIN** :
  - Droits complets d'administration.

---

## ⚠️ Fonctionnalités non terminées / Limites

1. **Persistance en fichier JSON (`data.json`)** :
   - Adapté pour un prototype et un TP d'évaluation. Pour un passage à l'échelle en production, remplacer par une base de données relationnelle (PostgreSQL avec transactions ACID) ou document (MongoDB).
2. **Tokens de démonstration basés sur HMAC** :
   - Les tokens utilisent une signature HMAC sha256 simplifiée pour éviter des dépendances externes lourdes. Dans une application d'entreprise, utiliser une bibliothèque standard telle que `jsonwebtoken` avec rotation de clés asymétriques (RS256).
3. **Mots de passe stockés en clair dans le JSON de test** :
   - Pour les besoins du TP et la facilité de démonstration des comptes, les mots de passe ne sont pas hachés avec `bcrypt`.
4. **WebSocket unifié sur un canal unique** :
   - Les événements sont actuellement diffusés à tous les clients connectés (`broadcast`). Dans un système de grande envergure, il conviendrait d'implémenter des canaux (rooms) par classe ou par étudiant pour restreindre la diffusion.
