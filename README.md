# CLM Nav — React / Vite

Projet converti depuis HTML/CSS/JS Vanilla vers React + Vite.

## Installation

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Le fichier `vite.config.js` utilise `base: "./"` pour fonctionner correctement sur GitHub Pages.

## Structure

- `src/App.jsx` : rendu principal de l’interface
- `src/navos.js` : logique GPS/carte/navigation adaptée à React
- `src/style.css` : design existant conservé

## Patch v1.3

- Ajout du choix d'itinéraire : plus rapide ou moins de kilomètres.
- Ajout d'une couche trafic visuelle sur le tracé.
- Ajustement du temps estimé avec un facteur trafic côté client.

Note : sans clé API trafic professionnelle (TomTom, HERE, Mapbox Traffic, etc.), le trafic est simulé pour garder le projet fonctionnel sur GitHub Pages/Vercel. Le code est préparé pour remplacer cette simulation par une vraie API.
