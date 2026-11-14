export type Language = "es" | "en";

export interface Translations {
  navbar: {
    title: string;
    subtitle: string;
    badge: string;
    missionLink: string;
    tutorialsLink: string;
    languageAriaLabel: string;
    selectLanguage: string;
    spanish: string;
    english: string;
  };
  controls: {
    coordsTitle: string;
    raLabel: string;
    raPlaceholder: string;
    raHelp: string;
    decLabel: string;
    decPlaceholder: string;
    decHelp: string;
    recommendedTargets: string;
    queryTitle: string;
    collectionLabel: string;
    bandLabel: string;
    allBands: string;
    radiusLabel: string;
    sizeLabel: string;
    queryButton: string;
    queryingButton: string;
    displayTitle: string;
    stretchLabel: string;
    stretchOptions: {
      asinh: string;
      log: string;
      sqrt: string;
      linear: string;
    };
    colormapLabel: string;
    colormapOptions: {
      inferno: string;
      viridis: string;
      plasma: string;
      magma: string;
      gray: string;
    };
    subtractZodi: string;
    showCrosshair: string;
  };
  viewer: {
    defaultTitle: string;
    centerCoords: (params: { ra: string; dec: string; size: string }) => string;
    enterCoordsPrompt: string;
    savePng: string;
    savePngTitle: string;
    originalFits: string;
    originalFitsTitle: string;
    altCutout: string;
    zoomInTitle: string;
    zoomOutTitle: string;
    resetZoomTitle: string;
    emptyTitle: string;
    emptySubtitle: string;
    detectorBand: string;
    wavelength: string;
    infrared: string;
    dimensions: string;
    fluxMedianMax: string;
    copySiaTitle: string;
    copyCutoutTitle: string;
  };
  observations: {
    title: string;
    searching: string;
    emptyDesc: string;
    expTime: (seconds: number) => string;
    irFallback: string;
  };
  status: {
    invalidRa: string;
    invalidDec: string;
    queryingSia: (params: { ra: string; dec: string; collection: string }) => string;
    noImagesFound: (params: { collection: string; ra: string; dec: string }) => string;
    downloadingFits: (params: { band: string; id: string }) => string;
    renderError: string;
    unexpectedError: string;
    fitsNoImage: string;
    fitsInvalidDimensions: string;
    fitsAllNan: string;
    fitsCanvasError: string;
  };
  presets: Array<{
    id: string;
    label: string;
    category: string;
    ra: string;
    dec: string;
    collection: string;
    description: string;
  }>;
}

export const translations: Record<Language, Translations> = {
  es: {
    navbar: {
      title: "Explorador de Imágenes Espectrales SPHEREx",
      subtitle:
        "Consulta y visualización interactiva de datos FITS de NASA / IPAC IRSA (SIA & IBE Cutouts)",
      badge: "Vite + React & Tailwind",
      missionLink: "Misión SPHEREx",
      tutorialsLink: "Tutoriales IRSA",
      languageAriaLabel: "Seleccionar idioma de la interfaz",
      selectLanguage: "Idioma",
      spanish: "Español",
      english: "Inglés",
    },
    controls: {
      coordsTitle: "Coordenadas Celestes (ICRS)",
      raLabel: "Ascensión Recta (RA)",
      raPlaceholder: "210.80227 o 08h55m10.8s",
      raHelp: "0° a 360° o formato HMS",
      decLabel: "Declinación (Dec)",
      decPlaceholder: "54.34895 o -7d14m42.5s",
      decHelp: "-90° a +90° o formato DMS",
      recommendedTargets: "Objetivos celestes recomendados:",
      queryTitle: "Parámetros de Consulta IRSA",
      collectionLabel: "Colección IRSA",
      bandLabel: "Detector / Banda",
      allBands: "Todas (D1 a D6)",
      radiusLabel: "Radio búsqueda (°)",
      sizeLabel: "Tamaño recorte (°)",
      queryButton: "Consultar Imagen SPHEREx",
      queryingButton: "Consultando IRSA...",
      displayTitle: "Opciones de Visualización",
      stretchLabel: "Escala de flujo",
      stretchOptions: {
        asinh: "Asinh (Recomendado)",
        log: "Logarítmica",
        sqrt: "Raíz Cuadrada",
        linear: "Lineal",
      },
      colormapLabel: "Paleta de color",
      colormapOptions: {
        inferno: "Inferno",
        viridis: "Viridis",
        plasma: "Plasma",
        magma: "Magma",
        gray: "Escala de grises",
      },
      subtractZodi: "Restar luz zodiacal (extensión ZODI)",
      showCrosshair: "Mostrar retícula en coordenada central",
    },
    viewer: {
      defaultTitle: "Visor Espectral SPHEREx",
      centerCoords: ({ ra, dec, size }) =>
        `Centro: RA ${ra}°, Dec ${dec}° · Tamaño de corte: ${size}°`,
      enterCoordsPrompt: 'Ingresa coordenadas celestes y presiona "Consultar Imagen SPHEREx".',
      savePng: "Guardar PNG",
      savePngTitle: "Descargar imagen PNG procesada",
      originalFits: "FITS Original",
      originalFitsTitle: "Descargar archivo FITS original desde IRSA",
      altCutout: "Recorte SPHEREx",
      zoomInTitle: "Acercar zoom",
      zoomOutTitle: "Alejar zoom",
      resetZoomTitle: "Restablecer zoom a 100%",
      emptyTitle: "Aún no se ha realizado ninguna consulta",
      emptySubtitle:
        "Selecciona uno de los objetivos celestes recomendados o ingresa coordenadas para visualizar el recorte FITS.",
      detectorBand: "Detector / Banda",
      wavelength: "Longitud de onda",
      infrared: "Infrarrojo",
      dimensions: "Dimensiones",
      fluxMedianMax: "Flujo (Mediana / Máx)",
      copySiaTitle: "Copiar URL SIA",
      copyCutoutTitle: "Copiar URL IBE Cutout",
    },
    observations: {
      title: "Exposiciones FITS",
      searching: "Buscando exposiciones astronómicas...",
      emptyDesc:
        "Aquí se listarán las exposiciones espectrales de SPHEREx que intersectan tus coordenadas.",
      expTime: (s) => `${s}s exp`,
      irFallback: "IR",
    },
    status: {
      invalidRa:
        "Ascensión Recta (RA) inválida. Usa grados decimales (0–360) o formato HMS (ej. 08h55m10.831s).",
      invalidDec:
        "Declinación (Dec) inválida. Usa grados decimales (-90 a +90) o formato DMS (ej. -7d14m42.53s).",
      queryingSia: ({ ra, dec, collection }) =>
        `Consultando catálogo IRSA SIA en RA=${ra}°, Dec=${dec}° (${collection})...`,
      noImagesFound: ({ collection, ra, dec }) =>
        `No se encontraron imágenes en "${collection}" para RA=${ra}°, Dec=${dec}°. Prueba ampliando el radio o cambiando de colección.`,
      downloadingFits: ({ band, id }) =>
        `Descargando y renderizando FITS (${band} — ${id})...`,
      renderError: "Error renderizando el recorte FITS.",
      unexpectedError: "Error inesperado consultando IRSA SIA.",
      fitsNoImage: "El archivo FITS no contiene extensión IMAGE 2D.",
      fitsInvalidDimensions: "Dimensiones de imagen FITS inválidas.",
      fitsAllNan: "Todos los píxeles del recorte son NaN o vacíos.",
      fitsCanvasError: "No se pudo inicializar contexto 2D de Canvas.",
    },
    presets: [
      {
        id: "test_target",
        label: "Objetivo Test (HMS/DMS)",
        category: "Sexagesimal",
        ra: "08h55m10.831s",
        dec: "-7d14m42.53s",
        collection: "spherex_dr1",
        description: "Coordenadas astronómicas en formato sexagesimal.",
      },
      {
        id: "m101",
        label: "Galaxia M101 (Molinete)",
        category: "Galaxias",
        ra: "210.80227",
        dec: "54.34895",
        collection: "spherex_dr1",
        description: "Gran galaxia espiral en la Osa Mayor.",
      },
      {
        id: "m51",
        label: "Galaxia M51 (Remolino)",
        category: "Galaxias",
        ra: "202.46958",
        dec: "47.19526",
        collection: "spherex_dr1",
        description: "Galaxia interactuando con NGC 5195.",
      },
      {
        id: "vela_carina",
        label: "Vela / Carina",
        category: "Plano Galáctico",
        ra: "127.69444",
        dec: "-39.17760",
        collection: "spherex_dr1",
        description: "Región rica en emisión interestelar e infrarroja.",
      },
      {
        id: "nep_deep",
        label: "Campo Profundo NEP",
        category: "Sondeo Profundo",
        ra: "270.0",
        dec: "66.0",
        collection: "spherex_dr1_deep",
        description: "Polo Eclíptico Norte (North Ecliptic Pole).",
      },
    ],
  },
  en: {
    navbar: {
      title: "SPHEREx Spectral Image Explorer",
      subtitle:
        "Interactive query and visualization of NASA / IPAC IRSA FITS data (SIA & IBE Cutouts)",
      badge: "Vite + React & Tailwind",
      missionLink: "SPHEREx Mission",
      tutorialsLink: "IRSA Tutorials",
      languageAriaLabel: "Select interface language",
      selectLanguage: "Language",
      spanish: "Spanish",
      english: "English",
    },
    controls: {
      coordsTitle: "Celestial Coordinates (ICRS)",
      raLabel: "Right Ascension (RA)",
      raPlaceholder: "210.80227 or 08h55m10.8s",
      raHelp: "0° to 360° or HMS format",
      decLabel: "Declination (Dec)",
      decPlaceholder: "54.34895 or -7d14m42.5s",
      decHelp: "-90° to +90° or DMS format",
      recommendedTargets: "Recommended celestial targets:",
      queryTitle: "IRSA Query Parameters",
      collectionLabel: "IRSA Collection",
      bandLabel: "Detector / Band",
      allBands: "All (D1 to D6)",
      radiusLabel: "Search radius (°)",
      sizeLabel: "Cutout size (°)",
      queryButton: "Query SPHEREx Image",
      queryingButton: "Querying IRSA...",
      displayTitle: "Visualization Options",
      stretchLabel: "Flux stretch",
      stretchOptions: {
        asinh: "Asinh (Recommended)",
        log: "Logarithmic",
        sqrt: "Square Root",
        linear: "Linear",
      },
      colormapLabel: "Color palette",
      colormapOptions: {
        inferno: "Inferno",
        viridis: "Viridis",
        plasma: "Plasma",
        magma: "Magma",
        gray: "Grayscale",
      },
      subtractZodi: "Subtract zodiacal light (ZODI extension)",
      showCrosshair: "Show crosshair at center coordinates",
    },
    viewer: {
      defaultTitle: "SPHEREx Spectral Viewer",
      centerCoords: ({ ra, dec, size }) =>
        `Center: RA ${ra}°, Dec ${dec}° · Cutout size: ${size}°`,
      enterCoordsPrompt: 'Enter celestial coordinates and click "Query SPHEREx Image".',
      savePng: "Save PNG",
      savePngTitle: "Download processed PNG image",
      originalFits: "Original FITS",
      originalFitsTitle: "Download original FITS file from IRSA",
      altCutout: "SPHEREx Cutout",
      zoomInTitle: "Zoom in",
      zoomOutTitle: "Zoom out",
      resetZoomTitle: "Reset zoom to 100%",
      emptyTitle: "No query performed yet",
      emptySubtitle:
        "Select one of the recommended celestial targets or enter coordinates to display the FITS cutout.",
      detectorBand: "Detector / Band",
      wavelength: "Wavelength",
      infrared: "Infrared",
      dimensions: "Dimensions",
      fluxMedianMax: "Flux (Median / Max)",
      copySiaTitle: "Copy SIA URL",
      copyCutoutTitle: "Copy IBE Cutout URL",
    },
    observations: {
      title: "FITS Exposures",
      searching: "Searching astronomical exposures...",
      emptyDesc:
        "SPHEREx spectral exposures intersecting your coordinates will be listed here.",
      expTime: (s) => `${s}s exp`,
      irFallback: "IR",
    },
    status: {
      invalidRa:
        "Invalid Right Ascension (RA). Use decimal degrees (0–360) or HMS format (e.g. 08h55m10.831s).",
      invalidDec:
        "Invalid Declination (Dec). Use decimal degrees (-90 to +90) or DMS format (e.g. -7d14m42.53s).",
      queryingSia: ({ ra, dec, collection }) =>
        `Querying IRSA SIA catalog at RA=${ra}°, Dec=${dec}° (${collection})...`,
      noImagesFound: ({ collection, ra, dec }) =>
        `No images found in "${collection}" for RA=${ra}°, Dec=${dec}°. Try increasing the radius or choosing another collection.`,
      downloadingFits: ({ band, id }) =>
        `Downloading and rendering FITS (${band} — ${id})...`,
      renderError: "Error rendering FITS cutout.",
      unexpectedError: "Unexpected error querying IRSA SIA.",
      fitsNoImage: "The FITS file does not contain a 2D IMAGE extension.",
      fitsInvalidDimensions: "Invalid FITS image dimensions.",
      fitsAllNan: "All pixels in cutout are NaN or empty.",
      fitsCanvasError: "Could not initialize Canvas 2D context.",
    },
    presets: [
      {
        id: "test_target",
        label: "Test Target (HMS/DMS)",
        category: "Sexagesimal",
        ra: "08h55m10.831s",
        dec: "-7d14m42.53s",
        collection: "spherex_dr1",
        description: "Astronomical coordinates in sexagesimal format.",
      },
      {
        id: "m101",
        label: "M101 Pinwheel Galaxy",
        category: "Galaxies",
        ra: "210.80227",
        dec: "54.34895",
        collection: "spherex_dr1",
        description: "Grand design spiral galaxy in Ursa Major.",
      },
      {
        id: "m51",
        label: "M51 Whirlpool Galaxy",
        category: "Galaxies",
        ra: "202.46958",
        dec: "47.19526",
        collection: "spherex_dr1",
        description: "Galaxy interacting with NGC 5195.",
      },
      {
        id: "vela_carina",
        label: "Vela / Carina",
        category: "Galactic Plane",
        ra: "127.69444",
        dec: "-39.17760",
        collection: "spherex_dr1",
        description: "Region rich in interstellar and infrared emission.",
      },
      {
        id: "nep_deep",
        label: "NEP Deep Field",
        category: "Deep Survey",
        ra: "270.0",
        dec: "66.0",
        collection: "spherex_dr1_deep",
        description: "North Ecliptic Pole deep survey field.",
      },
    ],
  },
};

