# CLM Nav — React/Vite

## Lancer le projet

```bash
npm install
npm run dev
```

## Mettre ta clé TomTom Traffic API

1. À la racine du projet, copie le fichier `.env.example`.
2. Renomme la copie en `.env`.
3. Remplace :

```env
VITE_TOMTOM_API_KEY=TA_CLE_TOMTOM_ICI
```

par ta vraie clé TomTom :

```env
VITE_TOMTOM_API_KEY=ta_vraie_cle_api
```

Puis relance le serveur Vite :

```bash
npm run dev
```

## Ce qui a été ajouté

- Trafic réel via TomTom Traffic Flow Segment Data.
- Coloration des segments de route selon le trafic.
- Ajustement du temps d’itinéraire selon les vitesses TomTom.
- Rafraîchissement live toutes les 60 secondes en navigation.
- Alerte si trafic dense détecté.
- Recalcul automatique en cas de bouchon important.
- Fallback simulation si la clé TomTom est absente ou si l’API ne répond pas.

## Important

Le trafic réel est actif uniquement si `VITE_TOMTOM_API_KEY` est renseigné. Sinon, le projet continue de fonctionner avec une simulation de trafic.
