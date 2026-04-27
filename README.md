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

## Recherche d'adresse précise

La recherche d'adresses utilise maintenant TomTom Search API via `VITE_TOMTOM_API_KEY` pour obtenir des résultats plus précis que Nominatim. Si la clé TomTom n'est pas configurée ou si l'API ne répond pas, le projet repasse automatiquement en fallback OpenStreetMap/Nominatim.

## Patch sécurité conduite

- Bouton retour dans la barre de recherche pour fermer la recherche sans choisir de destination.
- Limites de vitesse : récupérées via TomTom Routing avec `sectionType=speedLimit` quand disponible sur l'itinéraire.
- Zones de danger : recherche TomTom Search autour de la position avec les mots-clés `zone de danger`, `radar`, `speed camera`. Selon les pays et la couverture TomTom, ces résultats peuvent être absents ou incomplets.

## Logo CLMNav

La navbar cherche automatiquement un fichier :

```txt
public/clmnav-logo.png
```

Crée un dossier `public` si besoin, puis place ton logo dedans avec exactement ce nom.
Si le fichier n'existe pas, le texte `CLMNav` s'affiche en secours.

## Itinéraires marche / vélo

- Voiture : TomTom Routing + trafic live.
- Marche / vélo : TomTom est tenté d'abord avec une requête allégée.
- Si TomTom refuse le calcul, le projet utilise Valhalla comme fallback gratuit, sans revenir à OSRM.
