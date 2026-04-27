# CLM Nav — React/Vite

## Lancer le projet

```bash
npm install
npm run dev
```

## Clé TomTom

Le projet utilise maintenant TomTom pour :

- le calcul d’itinéraires via **TomTom Routing API** ;
- le trafic réel via **TomTom Traffic API** ;
- les temps ajustés avec trafic ;
- les alternatives plus fiables que OSRM.

À la racine du projet :

1. Copie `.env.example`
2. Renomme la copie en `.env`
3. Remplace :

```env
VITE_TOMTOM_API_KEY=TA_CLE_TOMTOM_ICI
```

par ta vraie clé TomTom.

Sur Vercel, ajoute aussi cette variable dans :

`Project Settings → Environment Variables`

```env
VITE_TOMTOM_API_KEY=ta_vraie_cle_api
```

Puis redeploy le projet.

## Important sécurité

Ne pousse jamais `.env` sur GitHub. Garde seulement `.env.example`.

Avec Vite, les variables `VITE_...` restent visibles côté navigateur après build. Pour limiter les risques, restreins ta clé TomTom aux domaines de ton site dans le dashboard TomTom.

## Patch appliqué

- Suppression du routage OSRM.
- Ajout de TomTom Routing API.
- Demande de deux itinéraires : rapide + plus court / alternative.
- Durées récupérées depuis TomTom avec trafic.
- Conservation du trafic live et refresh toutes les 60 secondes.
- Stabilisation de la couche bâtiments 3D avec détection/retry du source-layer MapLibre.
