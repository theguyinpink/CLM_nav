/* ============================================================
   NavOS — Premium Dark GPS Interface v1.2.1
   Correctif Spécial GitHub Pages (Timeout, Erreurs, CartoDB Free)
   ============================================================ */


export function initNavOS(maplibregl) {
  console.log("🚀 Initialisation de NavOS...");

  // 1. ÉTATS & VARIABLES GLOBALES
  const state = {
    origin: null,
    destination: null,
    userLocation: null,
    mode: "car",
    routePreference: "fastest",
    trafficSegments: [],
    trafficFactor: 1,
    trafficDelay: 0,
    favorites: JSON.parse(localStorage.getItem("navos_favs")) || [],
    isNavigating: false,
    watchId: null,
    routeCoords: [],
    routeSummary: null,
    routeSteps: [],
    routeOptions: {},
    selectedRouteKey: null,
    mapMode: "map",
    autoFollow: true,
    lastGpsPoint: null,
    smoothedHeading: 0,
    ignoreCameraEvent: false,
    trafficRefreshId: null,
    lastTrafficAlertAt: 0,
    lastAutoRerouteAt: 0,
    isRecalculatingTraffic: false,
    trafficSource: null,
  };

  let map;
  let originMarker = null;
  let destMarker = null;
  let userMarker = null;
  let recenterBtn = null;

  // 2. SÉCURITÉ LOADER (Timeout GitHub Pages)
  const hideLoader = () => {
    const loader = document.getElementById("loader");
    if (loader && !loader.classList.contains("hidden")) {
      loader.classList.add("hidden");
      console.log("✅ Loader masqué.");
    }
  };

  // Si la carte ou une API bloque plus de 4 secondes, on force l'affichage de l'UI
  const loaderTimeout = setTimeout(() => {
    hideLoader();
    console.warn(
      "⚠️ Loader masqué par sécurité après 4 secondes. (Une API externe est peut-être bloquée)",
    );
  }, 4000);

  const showToast = (message, type = "info") => {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-dot"></div><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("out");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // 3. STYLES DE CARTE (Totalement gratuits & publics, compatibles GitHub Pages)
  // CartoDB Dark Matter GL (Pas besoin de clé API)
  const VECTOR_STYLE_URL =
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
  const SAT_STYLE = {
    version: 8,
    sources: {
      sat: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
      },
    },
    layers: [{ id: "sat-layer", type: "raster", source: "sat" }],
  };

  try {
    console.log("🌍 Tentative de chargement MapLibre...");
    map = new maplibregl.Map({
      container: "map",
      style: VECTOR_STYLE_URL,
      center: [2.3522, 48.8566], // Paris
      zoom: 13,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    // Activer tactiles
    map.touchZoomRotate.enable();
    map.touchPitch.enable();

    // Échec du style ou de la source (Très commun sur GH Pages si domaine bloqué)
    map.on("error", (e) => {
      console.error("❌ Erreur MapLibre :", e.error || e);
      hideLoader(); // Force release
    });

    map.on("load", () => {
      console.log("✅ Carte chargée avec succès.");
      clearTimeout(loaderTimeout); // Annuler le timeout d'urgence
      hideLoader();
      injectCustomLayers();
    });

    map.on("style.load", () => {
      injectCustomLayers();
      restoreRouteData();
    });

    ["dragstart", "rotatestart", "pitchstart", "zoomstart"].forEach((eventName) => {
      map.on(eventName, () => {
        if (!state.isNavigating || state.ignoreCameraEvent) return;
        state.autoFollow = false;
        updateRecenterButton();
      });
    });

    // Synchro Boussole
    map.on("rotate", () => {
      const compassIcon = document.getElementById("compassIcon");
      if (compassIcon)
        compassIcon.style.transform = `rotate(${-map.getBearing()}deg)`;
    });
  } catch (err) {
    console.error("❌ Échec fatal d'initialisation MapLibre:", err);
    hideLoader();
    showToast("Erreur lors du chargement de la carte", "error");
  }

  // 4. INJECTION DES COUCHES DYNAMIQUES (Route + Bâtiments 3D)
  const routeFeature = () => ({
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: state.routeCoords || [],
    },
  });

  const trafficFeature = () => ({
    type: "FeatureCollection",
    features: state.trafficSegments || [],
  });

  const getDisplayCoords = (key) => state.routeOptions?.[key]?.displayCoords || state.routeOptions?.[key]?.coords || [];

  const routeOptionFeature = (key) => ({
    type: "Feature",
    properties: { key },
    geometry: {
      type: "LineString",
      coordinates: getDisplayCoords(key),
    },
  });

  const restoreRouteData = () => {
    try {
      if (map?.getSource("route")) {
        map.getSource("route").setData(routeFeature());
      }
      if (map?.getSource("route-traffic")) {
        map.getSource("route-traffic").setData(trafficFeature());
      }
      ["fastest", "shortest"].forEach((key) => {
        if (map?.getSource(`route-${key}`)) {
          map.getSource(`route-${key}`).setData(routeOptionFeature(key));
        }
      });
    } catch (error) {
      console.warn("Route non restaurée après changement de style :", error);
    }
  };

  const bringRouteToFront = () => {
    try {
      if (map.getLayer("route-casing")) map.moveLayer("route-casing");
      if (map.getLayer("route-traffic")) map.moveLayer("route-traffic");
      if (map.getLayer("route-fastest-casing")) map.moveLayer("route-fastest-casing");
      if (map.getLayer("route-fastest-line")) map.moveLayer("route-fastest-line");
      if (map.getLayer("route-shortest-casing")) map.moveLayer("route-shortest-casing");
      if (map.getLayer("route-shortest-line")) map.moveLayer("route-shortest-line");
      if (map.getLayer("route-line")) map.moveLayer("route-line");
    } catch (error) {
      console.warn("Impossible de replacer le tracé au-dessus de la carte :", error);
    }
  };

  const injectCustomLayers = () => {
    try {
      const sources = map.getStyle().sources || {};
      const vectorSourceKey = Object.keys(sources).find(
        (k) => sources[k].type === "vector",
      );

      // Bâtiments avant le tracé, sinon la route peut être cachée par les volumes 3D.
      if (vectorSourceKey && !map.getLayer("3d-buildings")) {
        map.addLayer({
          id: "3d-buildings",
          source: vectorSourceKey,
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 14,
          layout: { visibility: state.mapMode === "3d" ? "visible" : "none" },
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14,
              "#111827",
              18,
              "#242838",
            ],
            "fill-extrusion-height": [
              "coalesce",
              ["get", "render_height"],
              ["get", "height"],
              18,
            ],
            "fill-extrusion-base": [
              "coalesce",
              ["get", "render_min_height"],
              ["get", "min_height"],
              0,
            ],
            "fill-extrusion-opacity": 0.82,
          },
        });
        console.log("✅ Couche bâtiments 3D injectée sur source:", vectorSourceKey);
      }

      ["fastest", "shortest"].forEach((key) => {
        if (!map.getSource(`route-${key}`)) {
          map.addSource(`route-${key}`, { type: "geojson", data: routeOptionFeature(key) });
        }
        if (!map.getLayer(`route-${key}-casing`)) {
          map.addLayer({
            id: `route-${key}-casing`,
            type: "line",
            source: `route-${key}`,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#05070c", "line-width": 10, "line-opacity": 0.76 },
          });
        }
        if (!map.getLayer(`route-${key}-line`)) {
          map.addLayer({
            id: `route-${key}-line`,
            type: "line",
            source: `route-${key}`,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": key === "fastest" ? "#4A9EFF" : "#a78bfa", "line-width": 7, "line-opacity": 0.52 },
          });
          map.on("click", `route-${key}-line`, () => selectRouteOption(key));
          map.on("mouseenter", `route-${key}-line`, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", `route-${key}-line`, () => { map.getCanvas().style.cursor = ""; });
        }
      });

      if (!map.getSource("route")) {
        map.addSource("route", { type: "geojson", data: routeFeature() });
      }

      if (!map.getLayer("route-casing")) {
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#0B1220",
            "line-width": 12,
            "line-opacity": 0.72,
            "line-blur": 2,
          },
        });
      }

      if (!map.getLayer("route-line")) {
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#4A9EFF", "line-width": 6, "line-opacity": 0.62 },
        });
      }

      if (!map.getSource("route-traffic")) {
        map.addSource("route-traffic", { type: "geojson", data: trafficFeature() });
      }

      if (!map.getLayer("route-traffic")) {
        map.addLayer({
          id: "route-traffic",
          type: "line",
          source: "route-traffic",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 7,
            "line-opacity": 0.92,
            "line-blur": 0.3,
          },
        });
      }

      if (map.getLayer("3d-buildings")) {
        map.setLayoutProperty(
          "3d-buildings",
          "visibility",
          state.mapMode === "3d" ? "visible" : "none",
        );
      }

      restoreRouteData();
      bringRouteToFront();
    } catch (e) {
      console.warn(
        "⚠️ Erreur lors de l'injection des couches (normal si satellite est actif) :",
        e,
      );
    }
  };

  // 5. ROTATION AVEC LE CLIC MOLETTE (Middle Click)
  let isMiddleClicking = false;
  let startX, startY, startBearing, startPitch;

  if (document.getElementById("map")) {
    document.getElementById("map").addEventListener("mousedown", (e) => {
      if (e.button === 1) {
        // Clic molette
        e.preventDefault();
        isMiddleClicking = true;
        startX = e.clientX;
        startY = e.clientY;
        startBearing = map.getBearing();
        startPitch = map.getPitch();
        document.body.classList.add("map-grabbing");
      }
    });
  }

  window.addEventListener("mousemove", (e) => {
    if (isMiddleClicking && map) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newBearing = startBearing - deltaX * 0.5;
      let newPitch = startPitch - deltaY * 0.5;
      newPitch = Math.max(0, Math.min(80, newPitch)); // 80° max supporté

      map.jumpTo({ bearing: newBearing, pitch: newPitch });

      // Si on incline via la souris, activer la 3D visuellement
      if (
        newPitch > 20 &&
        state.mapMode === "map" &&
        map.getLayer("3d-buildings")
      ) {
        state.mapMode = "3d";
        document.getElementById("viewMap").classList.remove("active");
        document.getElementById("view3D").classList.add("active");
        map.setLayoutProperty("3d-buildings", "visibility", "visible");
      }
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 1 && isMiddleClicking) {
      isMiddleClicking = false;
      document.body.classList.remove("map-grabbing");
    }
  });

  // 6. UTILITAIRES
  const debounce = (f, w) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => f(...a), w);
    };
  };
  const formatDistance = (m) =>
    m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  const formatTime = (s) => {
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const rad = Math.PI / 180,
      a =
        Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
        Math.cos(lat1 * rad) *
          Math.cos(lat2 * rad) *
          Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    return 6371e3 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getRouteProfile = () =>
    state.mode === "car" ? "driving" : state.mode === "bike" ? "cycling" : "foot";

  const getRoutingService = () =>
    state.mode === "car" ? "car" : state.mode === "bike" ? "bike" : "foot";

  const getTomTomApiKey = () => {
    // 👉 Mets ta clé TomTom dans le fichier .env : VITE_TOMTOM_API_KEY=ta_cle_ici
    // En dépannage rapide, tu peux aussi remplacer "" ci-dessous par ta clé, mais .env est recommandé.
    return import.meta.env.VITE_TOMTOM_API_KEY || "";
  };

  const fetchTomTomTrafficAtPoint = async (lat, lon) => {
    const key = getTomTomApiKey();
    if (!key) return null;

    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=KMPH&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TomTom Traffic HTTP ${res.status}`);
    const data = await res.json();
    const flow = data?.flowSegmentData;
    if (!flow?.currentSpeed || !flow?.freeFlowSpeed) return null;

    const ratio = Math.max(0.05, Math.min(1.2, flow.currentSpeed / flow.freeFlowSpeed));
    let level = "fluid";
    let color = "#34d399";
    if (ratio < 0.45) {
      level = "heavy";
      color = "#ef4444";
    } else if (ratio < 0.75) {
      level = "slow";
      color = "#f59e0b";
    }

    return {
      level,
      color,
      ratio,
      factor: Math.max(1, 1 / ratio),
      currentSpeed: flow.currentSpeed,
      freeFlowSpeed: flow.freeFlowSpeed,
      confidence: flow.confidence ?? 0,
    };
  };

  const simulatedTrafficAtSegment = (part, i) => {
    const nowBucket = Math.floor(Date.now() / 60000);
    const seed = Math.abs(
      Math.sin((part[0][0] * 91.7 + part[0][1] * 53.3 + nowBucket * 0.13 + i) * 12.9898),
    );
    if (seed > 0.78) return { level: "heavy", factor: 1.65, color: "#ef4444", simulated: true };
    if (seed > 0.55) return { level: "slow", factor: 1.28, color: "#f59e0b", simulated: true };
    return { level: "fluid", factor: 1.02, color: "#34d399", simulated: true };
  };

  const buildTrafficSegments = async (coords, duration) => {
    if (!coords || coords.length < 2 || state.mode !== "car") {
      state.trafficSegments = [];
      state.trafficFactor = 1;
      state.trafficDelay = 0;
      state.trafficSource = null;
      return;
    }

    const step = Math.max(2, Math.floor(coords.length / 12));
    const features = [];
    let weightedFactor = 0;
    let weightedLength = 0;
    let usedLiveTraffic = false;

    for (let i = 0; i < coords.length - 1; i += step) {
      const part = coords.slice(i, Math.min(coords.length, i + step + 1));
      if (part.length < 2) continue;

      let segmentLength = 0;
      for (let j = 1; j < part.length; j++) {
        segmentLength += getDistance(part[j - 1][1], part[j - 1][0], part[j][1], part[j][0]);
      }

      let traffic = null;
      try {
        const mid = part[Math.floor(part.length / 2)];
        traffic = await fetchTomTomTrafficAtPoint(mid[1], mid[0]);
        if (traffic) usedLiveTraffic = true;
      } catch (error) {
        console.warn("TomTom Traffic indisponible sur un segment, fallback simulation :", error);
      }

      if (!traffic) traffic = simulatedTrafficAtSegment(part, i);

      weightedFactor += traffic.factor * segmentLength;
      weightedLength += segmentLength;
      features.push({
        type: "Feature",
        properties: {
          level: traffic.level,
          factor: traffic.factor,
          color: traffic.color,
          live: !traffic.simulated,
          currentSpeed: traffic.currentSpeed || null,
          freeFlowSpeed: traffic.freeFlowSpeed || null,
        },
        geometry: { type: "LineString", coordinates: part },
      });
    }

    const factor = weightedLength > 0 ? weightedFactor / weightedLength : 1;
    state.trafficSegments = features;
    state.trafficFactor = Math.max(1, Math.min(2.4, factor));
    state.trafficDelay = Math.max(0, duration * (state.trafficFactor - 1));
    state.trafficSource = usedLiveTraffic ? "TomTom live" : "simulation";
  };

  const updateTrafficUI = () => {
    const status = document.getElementById("trafficStatus");
    const navTraffic = document.getElementById("navTraffic");
    const icon = document.getElementById("trafficIcon");
    const delayMin = Math.round((state.trafficDelay || 0) / 60);

    let label = "fluide";
    if (state.mode !== "car") label = "non actif";
    else if (delayMin >= 10) label = "bouchons +" + delayMin + " min";
    else if (delayMin >= 3) label = "ralenti +" + delayMin + " min";

    const source = state.trafficSource ? ` (${state.trafficSource})` : "";
    if (status) status.textContent = "Trafic : " + label + source;
    if (navTraffic) navTraffic.textContent = "trafic " + label;
    if (icon) {
      icon.classList.remove("traffic-good", "traffic-medium", "traffic-heavy");
      icon.classList.add(delayMin >= 10 ? "traffic-heavy" : delayMin >= 3 ? "traffic-medium" : "traffic-good");
    }
  };

  const adjustedDuration = (duration) =>
    state.mode === "car" ? Math.round(duration * (state.trafficFactor || 1)) : Math.round(duration);

  // 7. MARQUEURS MAPLIBRE
  const setMarker = (type, lat, lon, title) => {
    if (!map) return;
    const el = document.createElement("div");
    el.innerHTML = `<div class="marker-pin marker-pin-${type}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">${type === "origin" ? '<circle cx="12" cy="12" r="5"/>' : '<path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"/><circle cx="12" cy="9" r="2.5" />'}</svg></div>`;
    const popup = new maplibregl.Popup({ offset: 36 }).setText(title);

    if (type === "origin") {
      if (originMarker) originMarker.remove();
      originMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map);
    } else {
      if (destMarker) destMarker.remove();
      destMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map);
    }
  };

  const modeIcon = () => {
    if (state.mode === "bike") {
      return '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="17.5" r="3.2"/><circle cx="18.5" cy="17.5" r="3.2"/><path d="M8.5 17.5l3-7 3 7m-3-7h3.5l2.2 7M10.4 7h3.2M8.5 17.5h6"/></svg>';
    }
    if (state.mode === "foot") {
      return '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4"/><path d="M10.5 9l-2.2 4.5 3.2 2.2-2 5M13.5 9l2.2 4.2 2.8 1.3M12 11.5l2.4 3.3-1.1 5.2"/></svg>';
    }
    return '<svg viewBox="0 0 24 24"><path d="M6.5 16h11l1.2-4.5a2 2 0 0 0-1.9-2.5H7.2a2 2 0 0 0-1.9 2.5L6.5 16Z"/><path d="M8 9l1.5-3h5L16 9M7 16v2M17 16v2"/><circle cx="8.5" cy="17.5" r="1.5"/><circle cx="15.5" cy="17.5" r="1.5"/></svg>';
  };

  const updateUserMarker = (lat, lon, heading = state.smoothedHeading) => {
    if (!map) return;
    if (!userMarker) {
      const el = document.createElement("div");
      el.className = "user-avatar-marker";
      el.innerHTML = '<div class="user-avatar-aura"></div><div class="user-avatar-core" data-mode="' + state.mode + '">' + modeIcon() + '</div>';
      userMarker = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
        .setLngLat([lon, lat])
        .addTo(map);
    } else {
      userMarker.setLngLat([lon, lat]);
      const core = userMarker.getElement().querySelector(".user-avatar-core");
      if (core) {
        core.dataset.mode = state.mode;
        core.innerHTML = modeIcon();
      }
    }
    const core = userMarker.getElement().querySelector(".user-avatar-core");
    if (core) core.style.transform = "rotate(" + (heading || 0) + "deg)";
  };

  const bearingBetween = (from, to) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const dLon = toRad(to.lon - from.lon);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  const smoothHeading = (target) => {
    if (!Number.isFinite(target)) return state.smoothedHeading;
    let diff = ((target - state.smoothedHeading + 540) % 360) - 180;
    if (Math.abs(diff) < 4) return state.smoothedHeading;
    state.smoothedHeading = (state.smoothedHeading + diff * 0.22 + 360) % 360;
    return state.smoothedHeading;
  };

  const runCameraUpdate = (options) => {
    if (!map) return;
    state.ignoreCameraEvent = true;
    map.easeTo({ ...options, duration: 650 });
    setTimeout(() => {
      state.ignoreCameraEvent = false;
    }, 750);
  };

  const updateRecenterButton = () => {
    if (!recenterBtn) return;
    recenterBtn.classList.toggle("visible", state.isNavigating);
    recenterBtn.classList.toggle("active", state.autoFollow);
    recenterBtn.textContent = state.autoFollow ? "Suivi actif" : "Recentrer";
  };

  const ensureRecenterButton = () => {
    if (recenterBtn) return;
    recenterBtn = document.createElement("button");
    recenterBtn.type = "button";
    recenterBtn.className = "recenter-nav-btn";
    recenterBtn.textContent = "Recentrer";
    recenterBtn.addEventListener("click", () => {
      if (!state.userLocation || !map) return;
      state.autoFollow = true;
      updateRecenterButton();
      runCameraUpdate({
        center: [state.userLocation.lon, state.userLocation.lat],
        zoom: Math.max(map.getZoom(), 17),
        pitch: state.mapMode === "3d" ? 65 : map.getPitch(),
        bearing: state.smoothedHeading || map.getBearing(),
      });
    });
    document.body.appendChild(recenterBtn);
  };

  // 8. AUTOCOMPLETE NOMINATIM
  const searchAddress = async (query, container, type) => {
    if (query.length < 3) return container.classList.remove("open");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=FR`,
      );
      const data = await res.json();
      container.innerHTML = "";
      if (!data.length) return container.classList.remove("open");
      data.forEach((place) => {
        const item = document.createElement("div");
        item.className = "autocomplete-item";
        const parts = place.display_name.split(", ");
        item.innerHTML = `<div class="autocomplete-item-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/></svg></div><div class="autocomplete-item-text"><div class="autocomplete-item-name">${parts[0]}</div><div class="autocomplete-item-addr">${parts.slice(1, 3).join(", ")}</div></div>`;
        item.addEventListener("click", () => {
          const lat = parseFloat(place.lat),
            lon = parseFloat(place.lon);
          if (type === "origin") {
            state.origin = { lat, lon, name: parts[0] };
            document.getElementById("originInput").value = parts[0];
            const navOriginInput = document.getElementById("navOriginInput");
            if (navOriginInput) navOriginInput.value = parts[0];
            setMarker("origin", lat, lon, parts[0]);
            if (state.destination) calculateRoute();
          }
          if (type === "dest") {
            state.destination = { lat, lon, name: parts[0] };
            document.getElementById("destInput").value = parts[0];
            const navSearchInput = document.getElementById("navSearchInput");
            if (navSearchInput) navSearchInput.value = parts[0];
            document.getElementById("searchNav")?.classList.add("expanded");
            document.getElementById("clearDest").style.display = "flex";
            setMarker("dest", lat, lon, parts[0]);
            calculateRoute();
          }
          container.classList.remove("open");

          if (map && state.origin && state.destination)
            map.fitBounds(
              new maplibregl.LngLatBounds(
                [state.origin.lon, state.origin.lat],
                [state.destination.lon, state.destination.lat],
              ),
              { padding: 80 },
            );
          else if (map) map.flyTo({ center: [lon, lat], zoom: 14 });
        });
        container.appendChild(item);
      });
      container.classList.add("open");
    } catch (e) {
      console.error("API Recherche:", e);
    }
  };

  const originInput = document.getElementById("originInput");
  const destInput = document.getElementById("destInput");
  if (originInput)
    originInput.addEventListener(
      "input",
      debounce(
        (e) =>
          searchAddress(
            e.target.value,
            document.getElementById("originSuggestions"),
            "origin",
          ),
        400,
      ),
    );
  if (destInput)
    destInput.addEventListener(
      "input",
      debounce(
        (e) =>
          searchAddress(
            e.target.value,
            document.getElementById("destSuggestions"),
            "dest",
          ),
        400,
      ),
    );
  const navSearchInput = document.getElementById("navSearchInput");
  const navOriginInput = document.getElementById("navOriginInput");
  if (navSearchInput) {
    navSearchInput.addEventListener("focus", () => document.getElementById("searchNav")?.classList.add("focused"));
    navSearchInput.addEventListener("input", debounce((e) =>
      searchAddress(e.target.value, document.getElementById("navDestSuggestions"), "dest"), 400));
  }
  if (navOriginInput) {
    navOriginInput.addEventListener("input", debounce((e) =>
      searchAddress(e.target.value, document.getElementById("navOriginSuggestions"), "origin"), 400));
  }

  document.addEventListener("click", () => {
    const lists = ["originSuggestions", "destSuggestions", "navOriginSuggestions", "navDestSuggestions"];
    lists.forEach((id) => document.getElementById(id)?.classList.remove("open"));
  });

  const clearDestBtn = document.getElementById("clearDest");
  if (clearDestBtn)
    clearDestBtn.addEventListener("click", (e) => {
      document.getElementById("destInput").value = "";
      state.destination = null;
      if (destMarker) destMarker.remove();
      e.currentTarget.style.display = "none";
      if (map && map.getSource("route"))
        map
          .getSource("route")
          .setData({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          });
      if (map && map.getSource("route-traffic")) map.getSource("route-traffic").setData({ type: "FeatureCollection", features: [] });
      state.trafficSegments = [];
      document.body.classList.remove("route-ready");
      document.getElementById("routeInfo").style.display = "none";
      document.getElementById("routeLowBar")?.classList.remove("active");
      document.getElementById("clearRouteBtn").style.display = "none";
    });

  // 9. ROUTAGE OSRM — nouvelle UX : deux tracés visibles puis sélection sur la carte
  const clearRouteVisuals = () => {
    state.routeCoords = [];
    state.routeSummary = null;
    state.routeSteps = [];
    state.routeOptions = {};
    state.selectedRouteKey = null;
    state.trafficSegments = [];
    if (map?.getSource("route")) map.getSource("route").setData(routeFeature());
    if (map?.getSource("route-traffic")) map.getSource("route-traffic").setData({ type: "FeatureCollection", features: [] });
    ["fastest", "shortest"].forEach((key) => {
      if (map?.getSource(`route-${key}`)) map.getSource(`route-${key}`).setData(routeOptionFeature(key));
    });
    const routeInfo = document.getElementById("routeInfo");
    const lowBar = document.getElementById("routeLowBar");
    if (routeInfo) routeInfo.style.display = "none";
    if (lowBar) lowBar.classList.remove("active");
    document.body.classList.remove("route-ready");
  };

  const paintRouteSelection = () => {
    if (!map) return;
    ["fastest", "shortest"].forEach((key) => {
      const active = state.selectedRouteKey === key;
      if (map.getLayer(`route-${key}-line`)) {
        map.setPaintProperty(`route-${key}-line`, "line-opacity", active ? 0.98 : 0.46);
        map.setPaintProperty(`route-${key}-line`, "line-width", active ? 8 : 6);
      }
      if (map.getLayer(`route-${key}-casing`)) {
        map.setPaintProperty(`route-${key}-casing`, "line-width", active ? 14 : 10);
      }
    });
  };

  const updateLowBar = () => {
    const lowBar = document.getElementById("routeLowBar");
    const hint = document.getElementById("lowRouteHint");
    const time = document.getElementById("lowRouteTime");
    const dist = document.getElementById("lowRouteDistance");
    const traffic = document.getElementById("lowRouteTraffic");
    const startBtn = document.getElementById("lowStartNavBtn");
    if (!lowBar) return;
    const opt = state.routeOptions?.[state.selectedRouteKey];
    lowBar.classList.toggle("active", Boolean(opt));
    document.body.classList.toggle("route-ready", Boolean(opt));
    if (!opt) return;
    if (hint) {
      if (opt.isFallbackAlternative) hint.textContent = "Variante courte visuelle — API alternative indisponible";
      else hint.textContent = state.selectedRouteKey === "fastest" ? "Trajet le plus rapide" : "Trajet avec moins de kilomètres";
    }
    if (time) time.textContent = formatTime(opt.durationWithTraffic || opt.duration);
    if (dist) dist.textContent = formatDistance(opt.dist);
    const delayMin = Math.round((opt.trafficDelay || 0) / 60);
    if (traffic) traffic.textContent = state.mode === "car" ? (delayMin >= 3 ? `Trafic +${delayMin} min` : "Trafic fluide") : "Trafic non actif";
    if (startBtn) startBtn.disabled = false;
  };

  const selectRouteOption = (key) => {
    const opt = state.routeOptions?.[key];
    if (!opt) return;
    state.selectedRouteKey = key;
    state.routePreference = key;
    state.routeCoords = opt.coords;
    state.routeSummary = { dist: opt.dist, duration: opt.duration, durationWithTraffic: opt.durationWithTraffic };
    state.routeSteps = opt.steps || [];
    state.trafficSegments = opt.trafficSegments || [];
    state.trafficFactor = opt.trafficFactor || 1;
    state.trafficDelay = opt.trafficDelay || 0;
    if (map) { restoreRouteData(); paintRouteSelection(); bringRouteToFront(); }
    updateLowBar();
    updateTrafficUI();
  };

  const routesLookSame = (a, b) => {
    if (!a?.geometry?.coordinates?.length || !b?.geometry?.coordinates?.length) return true;
    const ad = Math.abs((a.distance || 0) - (b.distance || 0));
    const td = Math.abs((a.duration || 0) - (b.duration || 0));
    const ac = a.geometry.coordinates;
    const bc = b.geometry.coordinates;
    const sameStart = ac[0]?.[0] === bc[0]?.[0] && ac[0]?.[1] === bc[0]?.[1];
    const sameEnd = ac.at(-1)?.[0] === bc.at(-1)?.[0] && ac.at(-1)?.[1] === bc.at(-1)?.[1];
    return sameStart && sameEnd && ad < 25 && td < 8;
  };

  const makeDisplayOffsetCoords = (coords, meters = 18) => {
    // Décalage visuel léger uniquement si l'API ne renvoie pas de vraie alternative.
    // Ça évite d'avoir deux traits exactement superposés et impossibles à sélectionner.
    const deg = meters / 111320;
    return (coords || []).map(([lng, lat], index) => {
      const previous = coords[Math.max(0, index - 1)] || [lng, lat];
      const next = coords[Math.min(coords.length - 1, index + 1)] || [lng, lat];
      const dx = next[0] - previous[0];
      const dy = next[1] - previous[1];
      const len = Math.hypot(dx, dy) || 1;
      return [lng + (-dy / len) * deg, lat + (dx / len) * deg];
    });
  };

  const makeRouteOption = async (key, route) => {
    const oldSegments = state.trafficSegments;
    const oldFactor = state.trafficFactor;
    const oldDelay = state.trafficDelay;
    const oldSource = state.trafficSource;
    await buildTrafficSegments(route.geometry.coordinates, route.duration);
    const opt = {
      key,
      coords: route.geometry.coordinates,
      dist: route.distance,
      duration: route.duration,
      durationWithTraffic: adjustedDuration(route.duration),
      trafficSegments: [...state.trafficSegments],
      trafficFactor: state.trafficFactor,
      trafficDelay: state.trafficDelay,
      steps: route.legs?.[0]?.steps || [],
    };
    state.trafficSegments = oldSegments;
    state.trafficFactor = oldFactor;
    state.trafficDelay = oldDelay;
    state.trafficSource = oldSource;
    return opt;
  };

  const ensureOriginFromCurrentPosition = () => new Promise((resolve) => {
    if (state.origin) return resolve(true);
    if (state.userLocation) {
      state.origin = { ...state.userLocation, name: "Ma position" };
      const input = document.getElementById("navOriginInput") || document.getElementById("originInput");
      if (input) input.value = "Ma position";
      setMarker("origin", state.origin.lat, state.origin.lon, "Ma position");
      return resolve(true);
    }
    if (!navigator.geolocation) { showToast("Position indisponible, choisissez un départ", "error"); return resolve(false); }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        state.origin = { ...state.userLocation, name: "Ma position" };
        const input = document.getElementById("navOriginInput") || document.getElementById("originInput");
        if (input) input.value = "Ma position";
        setMarker("origin", state.origin.lat, state.origin.lon, "Ma position");
        updateUserMarker(state.origin.lat, state.origin.lon);
        resolve(true);
      },
      () => { showToast("Autorisez la position ou saisissez un départ", "error"); document.getElementById("searchNav")?.classList.add("expanded"); resolve(false); },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
    );
  });

  const calculateRoute = async () => {
    const ok = await ensureOriginFromCurrentPosition();
    if (!ok || !state.destination) return;
    const calcBtn = document.getElementById("calcBtn");
    const navStatus = document.getElementById("navSearchStatus");
    if (calcBtn) { calcBtn.disabled = true; calcBtn.innerHTML = "Calcul..."; }
    if (navStatus) navStatus.textContent = "Calcul des 2 itinéraires…";
    try {
      clearRouteVisuals();
      const profile = getRouteProfile();
      const service = getRoutingService();
      const res = await fetch(`https://routing.openstreetmap.de/routed-${service}/route/v1/${profile}/${state.origin.lon},${state.origin.lat};${state.destination.lon},${state.destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=3`);
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes?.length) throw new Error("Réponse OSRM invalide");
      const fastest = data.routes.reduce((best, current) => current.duration < best.duration ? current : best);
      const shortest = data.routes.reduce((best, current) => current.distance < best.distance ? current : best);
      const [fastestOption, rawShortestOption] = await Promise.all([
        makeRouteOption("fastest", fastest),
        makeRouteOption("shortest", shortest),
      ]);
      const shortestOption = { ...rawShortestOption };
      if (data.routes.length < 2 || routesLookSame(fastest, shortest)) {
        // OSRM public ne fournit pas toujours une alternative. On garde le vrai tracé pour la navigation,
        // mais on décale l'affichage du second choix pour qu'il soit cliquable et compréhensible visuellement.
        shortestOption.displayCoords = makeDisplayOffsetCoords(shortestOption.coords, 20);
        shortestOption.isFallbackAlternative = true;
      }
      state.routeOptions = { fastest: fastestOption, shortest: shortestOption };
      if (map) {
        injectCustomLayers();
        restoreRouteData();
        const first = state.routeOptions.fastest.coords[0];
        const bounds = new maplibregl.LngLatBounds(first, first);
        Object.values(state.routeOptions).forEach((opt) => opt.coords.forEach((c) => bounds.extend(c)));
        map.fitBounds(bounds, { padding: { top: 130, bottom: 190, left: 55, right: 55 } });
      }
      selectRouteOption("fastest");
      if (navStatus) {
        navStatus.textContent = state.routeOptions.shortest?.isFallbackAlternative
          ? "Cliquez sur un tracé. OSRM n'a renvoyé qu'un vrai trajet, la variante courte est affichée séparément."
          : "Cliquez sur un tracé pour choisir votre trajet.";
      }
      const clearBtn = document.getElementById("clearRouteBtn");
      if (clearBtn) clearBtn.style.display = "flex";
    } catch (e) {
      console.error(e);
      showToast("Impossible de calculer les itinéraires", "error");
      if (navStatus) navStatus.textContent = "Calcul impossible.";
    } finally {
      if (calcBtn) { calcBtn.disabled = false; calcBtn.innerHTML = "Calculer"; }
    }
  };

  if (document.getElementById("calcBtn")) document.getElementById("calcBtn").addEventListener("click", calculateRoute);
  document.getElementById("lowStartNavBtn")?.addEventListener("click", () => startNavigation());

  document.querySelectorAll(".pref-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const key = e.currentTarget.dataset.pref;
      if (state.routeOptions?.[key]) selectRouteOption(key);
      else { state.routePreference = key; if (state.origin && state.destination) calculateRoute(); }
    });
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      state.mode = e.currentTarget.dataset.mode;
      document.querySelectorAll(".mode-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.mode === state.mode);
      });
      if (state.userLocation) updateUserMarker(state.userLocation.lat, state.userLocation.lon);
      if (state.origin && state.destination) calculateRoute();
    });
  });


  const maybeAlertTraffic = (opt = state.routeOptions?.[state.selectedRouteKey]) => {
    if (!opt || state.mode !== "car") return;
    const delayMin = Math.round((opt.trafficDelay || 0) / 60);
    const now = Date.now();
    if (delayMin >= 5 && now - state.lastTrafficAlertAt > 90000) {
      state.lastTrafficAlertAt = now;
      showToast(`Trafic dense détecté : +${delayMin} min`, "error");
      const navNextStreet = document.getElementById("navNextStreet");
      if (navNextStreet) navNextStreet.textContent = `Trafic dense sur votre trajet (+${delayMin} min)`;
    }
  };

  const chooseBestRouteWithTraffic = () => {
    const options = Object.values(state.routeOptions || {});
    if (!options.length) return null;
    return options.reduce((best, opt) =>
      (opt.durationWithTraffic || opt.duration) < (best.durationWithTraffic || best.duration) ? opt : best,
    );
  };

  const refreshTrafficForCurrentRoute = async ({ allowReroute = false } = {}) => {
    if (!state.routeOptions?.[state.selectedRouteKey] || state.isRecalculatingTraffic) return;
    if (state.mode !== "car") return;
    state.isRecalculatingTraffic = true;
    try {
      const key = state.selectedRouteKey;
      const opt = state.routeOptions[key];
      await buildTrafficSegments(opt.coords, opt.duration);
      opt.trafficSegments = [...state.trafficSegments];
      opt.trafficFactor = state.trafficFactor;
      opt.trafficDelay = state.trafficDelay;
      opt.durationWithTraffic = adjustedDuration(opt.duration);

      if (state.selectedRouteKey === key) selectRouteOption(key);
      maybeAlertTraffic(opt);

      const delayMin = Math.round((opt.trafficDelay || 0) / 60);
      const now = Date.now();
      if (allowReroute && delayMin >= 8 && now - state.lastAutoRerouteAt > 120000) {
        state.lastAutoRerouteAt = now;
        showToast("Bouchon important : recalcul automatique…", "error");
        if (state.userLocation) state.origin = { ...state.userLocation, name: "Ma position" };
        await calculateRoute();
        const best = chooseBestRouteWithTraffic();
        if (best) selectRouteOption(best.key);
      }
    } catch (error) {
      console.warn("Refresh trafic impossible :", error);
    } finally {
      state.isRecalculatingTraffic = false;
    }
  };

  const startTrafficLiveRefresh = () => {
    if (state.trafficRefreshId) clearInterval(state.trafficRefreshId);
    refreshTrafficForCurrentRoute({ allowReroute: true });
    state.trafficRefreshId = setInterval(() => {
      refreshTrafficForCurrentRoute({ allowReroute: true });
    }, 60000);
  };

  const stopTrafficLiveRefresh = () => {
    if (state.trafficRefreshId) {
      clearInterval(state.trafficRefreshId);
      state.trafficRefreshId = null;
    }
  };

  // 10. NAVIGATION TEMPS RÉEL (Geoloc sécurisée)
  const startNavigation = () => {
      if (!navigator.geolocation) return showToast("GPS non supporté", "error");
      state.isNavigating = true;
      state.autoFollow = true;
      state.lastGpsPoint = null;
      ensureRecenterButton();
      updateRecenterButton();
      document.getElementById("sidePanel").classList.add("nav-active");
      document.getElementById("navUI").classList.add("active");

      document.getElementById("navDistLeft").textContent = formatDistance(
        state.routeSummary.dist,
      );
      document.getElementById("navTimeLeft").textContent = formatTime(
        state.routeSummary.durationWithTraffic || state.routeSummary.duration,
      );
      document.getElementById("navNextStreet").textContent =
        state.routeSteps.length > 0
          ? state.routeSteps[0].maneuver.instruction
          : "Continuez sur l’itinéraire";
      updateTrafficUI();
      maybeAlertTraffic();
      startTrafficLiveRefresh();

      document.getElementById("view3D").click(); // Auto 3D
      if (map) {
        injectCustomLayers();
        bringRouteToFront();
        runCameraUpdate({
          center: [state.origin.lon, state.origin.lat],
          zoom: 18,
          pitch: 65,
          bearing: 0,
        });
      }

      state.watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude, heading } = pos.coords;
          const current = { lat: latitude, lon: longitude };
          let targetHeading = Number.isFinite(heading) && heading >= 0 ? heading : null;

          if (state.lastGpsPoint) {
            const moved = getDistance(
              state.lastGpsPoint.lat,
              state.lastGpsPoint.lon,
              latitude,
              longitude,
            );
            if (moved >= 6) {
              targetHeading = bearingBetween(state.lastGpsPoint, current);
              state.lastGpsPoint = current;
            }
          } else {
            state.lastGpsPoint = current;
          }

          const stableHeading = smoothHeading(targetHeading ?? state.smoothedHeading);
          updateUserMarker(latitude, longitude, stableHeading);
          state.userLocation = current;

          if (state.isNavigating && map) {
            if (state.autoFollow) {
              runCameraUpdate({
                center: [longitude, latitude],
                bearing: stableHeading,
                pitch: 65,
                zoom: Math.max(map.getZoom(), 17),
              });
            }

            let minAwaY = Infinity;
            state.routeCoords.forEach((c) => {
              const d = getDistance(latitude, longitude, c[1], c[0]);
              if (d < minAwaY) minAwaY = d;
            });
            if (minAwaY > 50) {
              showToast("Vous semblez vous éloigner de l’itinéraire", "error");
              state.origin = {
                lat: latitude,
                lon: longitude,
                name: "Ma position",
              };
              await calculateRoute();
            } else {
              const remain = Math.max(
                0,
                state.routeSummary.dist -
                  getDistance(
                    state.origin.lat,
                    state.origin.lon,
                    latitude,
                    longitude,
                  ),
              );
              document.getElementById("navDistLeft").textContent =
                formatDistance(remain);
            }
          }
        },
        (err) => {
          console.warn("GPS Warning:", err);
          showToast("Signal GPS faible ou refusé", "error");
        },
        { enableHighAccuracy: true },
      );
  };

  const startNavBtn = document.getElementById("startNavBtn");
  if (startNavBtn) startNavBtn.addEventListener("click", startNavigation);

  const endNavBtn = document.getElementById("endNavBtn");
  if (endNavBtn)
    endNavBtn.addEventListener("click", () => {
      state.isNavigating = false;
      state.autoFollow = false;
      updateRecenterButton();
      if (state.watchId) navigator.geolocation.clearWatch(state.watchId);
      stopTrafficLiveRefresh();
      document.getElementById("sidePanel").classList.remove("nav-active");
      document.getElementById("navUI").classList.remove("active");
      document.getElementById("viewMap").click();
      if (map)
        map.flyTo({
          center: [
            state.userLocation?.lon || state.origin?.lon || 2.35,
            state.userLocation?.lat || state.origin?.lat || 48.85,
          ],
          zoom: 14,
          pitch: 0,
          bearing: 0,
        });
      showToast("Navigation terminée");
    });

  // Menu mobile : ouvre/ferme le panneau d'itinéraire
  // Corrige le problème où le bouton hamburger était visible mais sans action sur téléphone.
  const menuToggle = document.getElementById("menuToggle");
  const sidePanel = document.getElementById("sidePanel");

  const toggleMobilePanel = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!sidePanel) return;
    sidePanel.classList.toggle("open");
    if (menuToggle) {
      const isOpen = sidePanel.classList.contains("open");
      menuToggle.classList.toggle("active", isOpen);
      menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  };

  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.addEventListener("click", toggleMobilePanel);
    menuToggle.addEventListener("touchend", toggleMobilePanel, { passive: false });
  }

  const mapContainer = document.getElementById("map");
  if (mapContainer) {
    mapContainer.addEventListener("click", () => {
      if (window.innerWidth <= 768 && sidePanel?.classList.contains("open")) {
        sidePanel.classList.remove("open");
        menuToggle?.classList.remove("active");
        menuToggle?.setAttribute("aria-expanded", "false");
      }
    });
  }

  // 11. CONTRÔLES CARTE UI
  const viewBtns = {
    map: document.getElementById("viewMap"),
    v3d: document.getElementById("view3D"),
    sat: document.getElementById("viewSat"),
  };
  const resetViewBtns = () =>
    Object.values(viewBtns).forEach((b) => {
      if (b) b.classList.remove("active");
    });

  if (viewBtns.map)
    viewBtns.map.addEventListener("click", () => {
      resetViewBtns();
      viewBtns.map.classList.add("active");
      state.mapMode = "map";
      if (map && map.getStyle().name !== "Dark Matter") {
        map.setStyle(VECTOR_STYLE_URL);
      } else if (map && map.getLayer("3d-buildings")) {
        map.setLayoutProperty("3d-buildings", "visibility", "none");
        bringRouteToFront();
      }
      if (map) map.easeTo({ pitch: 0 });
    });

  if (viewBtns.v3d)
    viewBtns.v3d.addEventListener("click", () => {
      resetViewBtns();
      viewBtns.v3d.classList.add("active");
      state.mapMode = "3d";
      if (map && map.getStyle().name !== "Dark Matter") {
        map.setStyle(VECTOR_STYLE_URL);
      } else if (map && map.getLayer("3d-buildings")) {
        map.setLayoutProperty("3d-buildings", "visibility", "visible");
        bringRouteToFront();
      }
      if (map) map.easeTo({ pitch: 60 });
    });

  if (viewBtns.sat)
    viewBtns.sat.addEventListener("click", () => {
      resetViewBtns();
      viewBtns.sat.classList.add("active");
      state.mapMode = "sat";
      if (map) map.setStyle(SAT_STYLE);
    });

  if (document.getElementById("zoomIn"))
    document.getElementById("zoomIn").addEventListener("click", () => {
      if (map) map.zoomIn();
    });
  if (document.getElementById("zoomOut"))
    document.getElementById("zoomOut").addEventListener("click", () => {
      if (map) map.zoomOut();
    });
  if (document.getElementById("compass"))
    document.getElementById("compass").addEventListener("click", () => {
      if (map)
        map.easeTo({ bearing: 0, pitch: state.mapMode === "3d" ? 60 : 0 });
    });

  if (document.getElementById("geolocateBtn"))
    document.getElementById("geolocateBtn").addEventListener("click", () => {
      if (!navigator.geolocation) return showToast("GPS non supporté", "error");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude,
            lon = pos.coords.longitude;
          state.userLocation = { lat, lon };
          state.origin = { lat, lon, name: "Ma position" };
          document.getElementById("originInput").value = "Ma position";
          updateUserMarker(lat, lon);
          if (map) map.flyTo({ center: [lon, lat], zoom: 15 });
        },
        (err) => {
          console.warn("Erreur geoloc:", err);
          showToast("Position refusée ou introuvable", "error");
        },
      );
    });

  if (document.getElementById("locateMe"))
    document.getElementById("locateMe").addEventListener("click", () => {
      if (state.userLocation && map)
        map.flyTo({
          center: [state.userLocation.lon, state.userLocation.lat],
          zoom: 16,
        });
      else document.getElementById("geolocateBtn").click();
    });

  return () => {
    try {
      if (state.watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(state.watchId);
      }
      stopTrafficLiveRefresh();
      if (map) map.remove();
    } catch (error) {
      console.warn("Nettoyage NavOS incomplet :", error);
    }
  };
}
