# 🌌 AstroExplore · Infrared Time-Domain Sky Explorer & Planet X Hunter

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-blue.svg)](https://www.spaceappschallenge.org/2026/find-a-team/ley-de-conservacion-del-mate/?tab=project)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite 6](https://img.shields.io/badge/Vite-6.2-646cff.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Scientific Integrity](https://img.shields.io/badge/Data-Real%20NASA%20IRSA-success.svg)](https://irsa.ipac.caltech.edu/SIA)

> **Team:** Ley de Conservación del Mate  
> **Challenge:** Planet X and SPHEREx (Advanced)  
> **Repository:** [TomasAchavalVinuesa/AstroExplore](https://github.com/TomasAchavalVinuesa/AstroExplore)

> [!IMPORTANT]
> **Full Documentation & Scientific Foundations:** All complete project documentation, theoretical background, mathematical derivations, and supporting materials are available in our Google Drive folder:  
> 👉 **[Access Full Documentation & Foundations on Google Drive](https://drive.google.com/drive/folders/1TIUwAkfaNALHzs7UsjKtbPUVdvedDxpk)**

---

## 🚀 Overview

**AstroExplore** is a client-side, open-source astronomical web platform built to unlock **NASA's SPHEREx** all-sky spectral survey (102 near-infrared spectral channels spanning $0.75 - 5.00\,\mu\text{m}$ across 6 Linear Variable Filter detector arrays) for students, educators, and citizen scientists.

By decoding raw multi-extension FITS archives from **NASA/IPAC IRSA** directly in the browser—with no heavy backend required—the platform turns complex infrared survey data into an interactive sky workspace for hunting moving sub-stellar bodies (brown dwarfs, Planet Nine candidates, asteroids), inspecting multi-epoch variability, and performing on-the-fly spectroscopic, thermodynamic, astrochemical, and astrobiological analysis.

---

## 🛠️ Core Interactive Astronomical Modules

### 1. ⏱️ Multi-Epoch Blink Comparator, Time-Lapse & Difference Imaging
- **Digital Blink Comparator:** Resurrects the classic blink comparator technique pioneered by Clyde Tombaugh during the discovery of Pluto (1930).
- **Epoch Time-Lapse:** Alternates between SPHEREx survey epochs with customizable playback intervals and multi-epoch trajectory tracking.
- **Pixel-Level Difference Math ($B - A$):** Cancels stationary background stars into neutral gray so moving objects (e.g., *Barnard's Star*, *WISE 0855*) and variable sources (*RW Aurigae*, *R Draconis*) stand out as distinct dipoles and monopoles.

### 2. 🌈 Instant 102-Band Spectrogram ($0.75 - 5.00\,\mu\text{m}$) & ROI Analysis
- **Live Spectral Profiling:** Extracts calibrated surface brightness ($\text{MJy/sr}$) across all 6 detector arrays (D1–D6) for any selected target or Region of Interest (ROI).
- **ROI Analysis Modal:** Inspects selected sky regions with multi-tab scientific diagnostics, saved ROI management, and KaTeX-rendered mathematical formulas.
- **Radiative Temperature Estimation:** Estimates effective temperatures via Wien's displacement law and continuum fitting.

### 3. 🔬 6-Detector H2RG Array Architecture & SNR Co-Addition Guide
- **Detector Array Visualization:** Explains the 6 H2RG detector arrays and computes the quadratic Signal-to-Noise Ratio gain from stacking exposures:
  $$\text{SNR}_{\text{coadd}} = \text{SNR}_{\text{single}} \times \sqrt{17} \approx 4.123\times \quad (+312\% \text{ gain})$$
- **Dual-Mode Interface:** Switches between *Explorer Mode* (intuitive analogies for students and newcomers) and *Scientific Mode* (variance maps, calibrated flux, and formal equations).

### 4. 🗺️ HiPS Sky Map, Universal Celestial Resolver & Deep-Linking
- **HiPS Sky Overlay:** Interactive sky map panel for spatial context and multi-survey navigation.
- **CDS Sesame Resolver:** Resolves celestial object names via SIMBAD, NED, and VizieR into exact ICRS coordinates, with toggleable sexagesimal and decimal coordinate formats.
- **Shareable URL State:** Encodes coordinates, field of view, stretch modes, and colormaps directly into URL parameters (`?ra=...&dec=...&fov=...`) for instant one-click sharing.

---

## 🧪 Specialized Scientific Analysis Labs (`src/features/`)

AstroExplore includes three decoupled, pure-TypeScript scientific analysis engines paired with interactive React labs:

1. **Temporal Statistics & Thermodynamics Lab (`src/features/statistics/`)**
   - Multi-epoch statistical analysis (MVUE estimators, variance testing, variability detection) combined with thermodynamic radiation modeling.
2. **Infrared Astrochemistry Lab (`src/features/chemistry/`)**
   - Applies the Beer-Lambert law and optical depth ($\tau(\lambda)$) to detect molecular vibrational absorption signatures ($\text{H}_2\text{O}$ ice, $\text{CH}_4$, $\text{CO}_2$, $\text{CO}$, $\text{NH}_3$, and PAHs) across the $0.75 - 5.00\,\mu\text{m}$ spectrum.
3. **Probabilistic Astrobiology & Habitability Lab (`src/features/astrobiology/`)**
   - Evaluates Bayesian astrobiological likelihoods, CHNOPS prebiotic chemistry indicators, and eutectic habitability metrics from real spectral and thermodynamic outputs.

---

## 🎨 Immersive Experience & Accessibility

- **Bilingual Support (EN / ES):** Full English and Spanish localization powered by `LanguageContext` and `translations.ts`.
- **Guided Interactive Tutorials:** Step-by-step onboarding overlays across the Entry Gate, Explorer, Sidebar, and ROI Analysis views, with keyboard navigation (`T`, Arrow keys, `Esc`).
- **Immersive Audio & Loading Experience:** Reactive Web Audio background music analyzer, UI sound effects, astrophysics quotes, and a playable **Asteroid Loading Mini-Game** while FITS cutouts are fetched and decoded.
- **Client-Side FITS Rendering Controls:** Linear, Log, Sqrt, and Asinh stretches, colormaps, and multi-version FITS gallery inspection.

---

## 🛰️ NASA Data Pipeline & Scientific Integrity ("The Unplug Test")

We enforce a strict scientific integrity principle:
> *"If we disconnect the NASA APIs and the web app still displays synthetic numbers, it is wrong."*

Every image, variance map, and spectrum in AstroExplore is retrieved directly from real astronomical archives and processed in the browser:
- **NASA/IPAC IRSA Simple Image Access (SIA v2):** Queries `spherex_dr1`, `spherex_dr1_deep`, and `spherex_qr3` observation metadata.
- **NASA/IPAC IRSA IBE Cutout REST API:** Fetches real-time multi-extension FITS cutouts.
- **Client-Side Web Worker FITS Decoder (`src/lib/fits.ts`, `src/lib/fitsWorker.ts`):** Parses binary FITS headers and HDUs (`IMAGE`, `VARIANCE`, `FLAGS`, `ZODI`, `EPSF`, `WCS-WAVE`) using `DataView` and renders via the HTML5 Canvas API.
- **API Health Detection:** Gracefully detects upstream archive downtime and notifies the user instead of fabricating data.

---

## 🧰 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **UI Framework** | React 19 (`react`, `react-dom`) |
| **Build Tool** | Vite 6 (`@vitejs/plugin-react`) |
| **Language** | TypeScript 5.7 (strict mode) |
| **Styling** | Tailwind CSS 3.4, PostCSS, Autoprefixer, `clsx`, `tailwind-merge` |
| **Icons & Math** | Lucide React, KaTeX |
| **Data Processing** | Browser-native `DataView`, Web Workers, HTML5 Canvas, Web Audio API |

---

## 📁 Project Structure

```text
src/
├── App.tsx                  # Main application shell, state & screen orchestration
├── components/              # UI panels, FITS viewer, Blink Comparator, HiPS map, tutorials, audio & mini-game
├── features/
│   ├── astrobiology/        # Bayesian astrobiology, CHNOPS & habitability engine + lab UI
│   ├── chemistry/           # Beer-Lambert infrared astrochemistry engine + lab UI
│   └── statistics/          # Multi-epoch temporal statistics & thermodynamics engine + lab UI
├── i18n/                    # Bilingual ES / EN context and translation dictionaries
└── lib/                     # IRSA SIA/IBE clients, FITS binary/worker parser, WCS/coordinates, audio & URL state
```

---

## ⚙️ Getting Started

### Prerequisites
- **Node.js** 18+ (Node.js 20+ recommended)
- **npm**

### Installation & Local Development
```bash
# Clone the repository
git clone https://github.com/TomasAchavalVinuesa/AstroExplore.git
cd AstroExplore

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
```bash
npm run build
npm run preview
```

---

## 📚 Academic References (APA 7th Edition)

All mathematical, thermodynamic, chemical, and physical models are grounded in standard university textbooks:
- **Çengel, Y. A., & Boles, M. A. (2011).** *Thermodynamics: An Engineering Approach* (7th ed.). McGraw-Hill.
- **Chang, R., & Goldsby, K. A. (2016).** *Chemistry* (12th ed.). McGraw-Hill Education.
- **Devore, J. L. (2016).** *Probability and Statistics for Engineering and the Sciences* (9th ed.). Cengage Learning.
- **Kreyszig, E. (2011).** *Advanced Engineering Mathematics* (10th ed.). John Wiley & Sons.
- **Young, H. D., & Freedman, R. A. (2018).** *Sears and Zemansky's University Physics* (14th ed.). Pearson.

---

## 🤖 AI Disclosure

In accordance with the NASA Space Apps Challenge 2026 submission guidelines:
- **Tools Used:** Google Gemini (Antigravity) and Anthropic Claude as AI pair-programming and documentation assistants.
- **Scope:** Used to accelerate TypeScript/React implementation, validate mathematical formulations, and build responsive UI/Canvas/SVG components.
- **Scientific Integrity:** AI was not used to fabricate synthetic astronomical data. All observations, pixels, and spectra originate directly from NASA/IPAC IRSA and standard astronomical resolvers.

---

## 👥 Team — Ley de Conservación del Mate

- **Jonás Villegas** — Lead Developer & Data Pipeline
- **Tomás Achával** — Research & Analysis
- **Joaquín Barrionuevo** — Astrophysics & Data
- **Facundo Bazán** — UI/UX & Frontend
- **Muriel / Uriel Domínguez** — Scientific Visualization
- **Jeremías Nolte** — Documentation & Review
