import type { DetectorId, DetectorMetadata } from "./types";

export const DETECTORS_METADATA: Record<DetectorId, DetectorMetadata> = {
  D1: {
    id: "D1",
    name: "Detector 1 · Óptico / NIR Temprano",
    nameEn: "Detector 1 · Optical / Early NIR",
    waveMin: 0.75,
    waveMax: 1.12,
    bandsCount: 17,
    resolvingPower: "R ≈ 41",
    simpleDescription:
      "Luz infrarroja más cercana a la vista humana. Muestra estrellas comunes maduras, enanas rojas M y galaxias cercanas con máxima nitidez espacial.",
    simpleDescriptionEn:
      "Infrared light closest to the human visible spectrum. Reveals mature stars, M-dwarfs, and nearby galaxies with optimal spatial sharpness.",
    scientificDescription:
      "Banda Hα corrida al rojo (z = 0.14–0.70). Espectroscopía de baja dispersión para mapeo de estructura a gran escala (LSS) e inflación cosmológica no-gaussiana.",
    scientificDescriptionEn:
      "Redshifted Hα line (z = 0.14–0.70). Low-dispersion spectroscopy for large-scale structure (LSS) mapping and non-Gaussian cosmological inflation constraints.",
    targetMolecules: ["Hα z-shifted (0.656 µm)", "Paschen-γ (1.094 µm)", "Enanas rojas M tardías"],
    targetMoleculesEn: ["Hα z-shifted (0.656 µm)", "Paschen-γ (1.094 µm)", "Late M-type dwarfs"],
    teffKelvin: "2580 K – 3860 K",
    colorHex: "#38bdf8",
  },
  D2: {
    id: "D2",
    name: "Detector 2 · Pico Estelar Galáctico",
    nameEn: "Detector 2 · Galactic Stellar Peak",
    waveMin: 1.11,
    waveMax: 1.64,
    bandsCount: 17,
    resolvingPower: "R ≈ 41",
    simpleDescription:
      "La zona donde más brillan las estrellas en el universo. Es el detector con mayor cantidad de estrellas visibles porque el polvo espacial casi no las apaga.",
    simpleDescriptionEn:
      "The wavelength window where stars shine brightest in the universe. Contains the highest stellar density as interstellar dust extinction is minimized.",
    scientificDescription:
      "Pico de 1.6 µm (H⁻ Opacity Bump en fotosferas estelares). Trazador estandarizado de masa estelar en galaxias y sondeo de z = 1.0–1.5.",
    scientificDescriptionEn:
      "1.6 µm peak (H⁻ opacity bump in stellar photospheres). Standardized galactic stellar mass tracer and cosmological survey window for z = 1.0–1.5.",
    targetMolecules: ["H⁻ Opacity Bump (1.6 µm)", "Paschen-β (1.282 µm)", "Masa estelar total"],
    targetMoleculesEn: ["H⁻ Opacity Bump (1.6 µm)", "Paschen-β (1.282 µm)", "Total Stellar Mass"],
    teffKelvin: "1760 K – 2610 K",
    colorHex: "#60a5fa",
  },
  D3: {
    id: "D3",
    name: "Detector 3 · Hielo de Agua y Polvo",
    nameEn: "Detector 3 · Water Ice & Interstellar Dust",
    waveMin: 1.63,
    waveMax: 2.42,
    bandsCount: 17,
    resolvingPower: "R ≈ 41",
    simpleDescription:
      "Buscador de hielo de agua en el cosmos. Detecta cometas, mundos helados y nubes densas donde están naciendo nuevos sistemas solares.",
    simpleDescriptionEn:
      "Cosmic water ice explorer. Detects comets, frozen outer bodies, and dense interstellar clouds where nascent planetary systems are born.",
    scientificDescription:
      "Banda de absorción de hielo de agua (H₂O a 2.02 µm) y absorción de primer sobretono de CO molecular (2.3 µm). Discos circunestelares y enanas L/T.",
    scientificDescriptionEn:
      "Water ice absorption band (H₂O at 2.02 µm) and first overtone CO absorption (2.30 µm). Circumstellar accretion disks and cool L/T-dwarfs.",
    targetMolecules: ["Hielo H₂O (2.02 µm)", "CO molecular (2.30 µm)", "Brackett-γ (2.166 µm)"],
    targetMoleculesEn: ["H₂O Ice (2.02 µm)", "Molecular CO (2.30 µm)", "Brackett-γ (2.166 µm)"],
    teffKelvin: "1200 K – 1780 K",
    colorHex: "#818cf8",
  },
  D4: {
    id: "D4",
    name: "Detector 4 · Línea de Nieve y Química Orgánica",
    nameEn: "Detector 4 · Snow Line & Organic Prebiotics",
    waveMin: 2.40,
    waveMax: 3.85,
    bandsCount: 17,
    resolvingPower: "R ≈ 35",
    simpleDescription:
      "Busca moléculas orgánicas complejas e hielo de agua profundo. Clave para rastrear los ingredientes de la vida en el espacio.",
    simpleDescriptionEn:
      "Probes complex organic molecules and deep water ice. Crucial for tracing the chemical building blocks of life throughout circumstellar disks.",
    scientificDescription:
      "Fuerte absorción de H₂O a 3.05 µm e hidrocarburos aromáticos policíclicos (PAH a 3.3 µm). Ubicación de la línea de nieve del agua en formación planetaria.",
    scientificDescriptionEn:
      "Deep water ice absorption at 3.05 µm and polycyclic aromatic hydrocarbons (PAH at 3.30 µm). Traces the water snow-line during planet formation.",
    targetMolecules: ["Hielo profundo H₂O (3.05 µm)", "PAH Orgánico (3.30 µm)", "Hielo CH₃OH (3.53 µm)"],
    targetMoleculesEn: ["Deep H₂O Ice (3.05 µm)", "Organic PAH (3.30 µm)", "CH₃OH Ice (3.53 µm)"],
    teffKelvin: "750 K – 1200 K",
    colorHex: "#a78bfa",
  },
  D5: {
    id: "D5",
    name: "Detector 5 · Dióxido de Carbono Prebiótico",
    nameEn: "Detector 5 · Prebiotic Carbon Dioxide",
    waveMin: 3.81,
    waveMax: 4.43,
    bandsCount: 17,
    resolvingPower: "R ≈ 110",
    simpleDescription:
      "Detector de alta resolución térmica. Rastrea hielo de dióxido de carbono (CO₂) en protoplanetas, asteroides y cometas.",
    simpleDescriptionEn:
      "High spectral resolution thermal channel. Tracks carbon dioxide (CO₂) ice in protoplanetary disks, asteroids, and outer cometary bodies.",
    scientificDescription:
      "Canal de alta resolución espectral (R ≈ 110) diseñado específicamente para resolver la banda de hielo de CO₂ a 4.27 µm y su isótopo ¹³CO₂ (4.38 µm).",
    scientificDescriptionEn:
      "High resolving power channel (R ≈ 110) engineered specifically to resolve the CO₂ ice absorption feature at 4.27 µm and its ¹³CO₂ isotope (4.38 µm).",
    targetMolecules: ["Hielo CO₂ (4.27 µm)", "Isótopo ¹³CO₂ (4.38 µm)", "Hielo XCN (4.62 µm)"],
    targetMoleculesEn: ["CO₂ Ice (4.27 µm)", "¹³CO₂ Isotope (4.38 µm)", "XCN Ice (4.62 µm)"],
    teffKelvin: "650 K – 760 K",
    colorHex: "#f472b6",
  },
  D6: {
    id: "D6",
    name: "Detector 6 · Objetos Fríos y Planeta X",
    nameEn: "Detector 6 · Ultra-Cold Bodies & Planet X",
    waveMin: 4.42,
    waveMax: 5.00,
    bandsCount: 17,
    resolvingPower: "R ≈ 130",
    simpleDescription:
      "¡Cámara térmica para objetos ultrafríos! Ideal para buscar el hipotético Planeta 9 / Planeta X, asteroides oscuros y enanas marrones heladas.",
    simpleDescriptionEn:
      "Deep thermal camera for ultra-cold objects! Tailored for hypothetical Planet Nine / Planet X, dark Kuiper Belt objects, and sub-stellar Y-dwarfs.",
    scientificDescription:
      "Máxima resolución espectral (R ≈ 130) y ventana térmica para cuerpos a T_eff ≈ 250–350 K (-23°C a +77°C) según Ley de Wien (λ_peak ≈ 2898/T). Banda de gas y hielo CO a 4.67 µm.",
    scientificDescriptionEn:
      "Maximum resolving power (R ≈ 130) and thermal sensitivity window for blackbody emitters at T_eff ≈ 250–350 K (-23°C to +77°C) via Wien's Law (λ_peak ≈ 2898/T). Gaseous and solid CO at 4.67 µm.",
    targetMolecules: ["Gas / Hielo CO (4.67 µm)", "Planeta X / Enanas Y", "T_eff Wien 250–350 K"],
    targetMoleculesEn: ["CO Gas / Ice (4.67 µm)", "Planet X / Y-Dwarfs", "Wien T_eff 250–350 K"],
    teffKelvin: "250 K – 650 K",
    colorHex: "#fb923c",
  },
};

export function getDetectorForWavelength(waveUm: number): DetectorMetadata | null {
  for (const det of Object.values(DETECTORS_METADATA)) {
    if (waveUm >= det.waveMin && waveUm <= det.waveMax) {
      return det;
    }
  }
  return null;
}

export function parseDetectorId(bandpassOrObsId: string): DetectorId | null {
  const upper = bandpassOrObsId.toUpperCase();
  const match = upper.match(/D([1-6])/);
  if (match) {
    return `D${match[1]}` as DetectorId;
  }
  return null;
}
