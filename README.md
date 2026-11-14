# SPHEREx Explorer — React + Vite & Tailwind CSS

Aplicación web desarrollada con **React 19**, **Vite**, **TypeScript** y **Tailwind CSS** para consultar, explorar y visualizar recortes de imágenes espectrales astronómicas de la misión **NASA SPHEREx** a partir de nombres de cuerpos celestes o coordenadas celestes (**Ascensión Recta** y **Declinación** en grados decimales o formato sexagesimal `HMS`/`DMS`).

## Características
- **Tecnología moderna:** React 19 + Vite 6 + TypeScript + Tailwind CSS (rápido, 100% en el cliente, sin dependencias pesadas de servidor).
- **Resolución y Catálogo de Cuerpos Celestes (CDS Sesame API):**
  - Buscador integrado en tiempo real conectado a **CDS Sesame** (`SIMBAD` / `NED` / `VizieR`) para resolver cualquier cuerpo celeste a sus coordenadas ICRS, tipo astronómico, movimiento propio y alias.
  - Catálogo destacado con objetos clave de la misión SPHEREx: **Barnard's Star**, **Epsilon Indi B** (par binario de enanas marrones), **WISE 0855** (`08h55m10.831s`, `-7d14m42.53s`), **RW Aurigae**, **R Draconis**, **M101**, **M51**, **Vela / Carina** y **Campo Profundo NEP**.
- **Consulta y Galería Multiversión SPHEREx:**
  - Descubrimiento simultáneo en paralelo de todas las versiones del archivo de SPHEREx (`spherex_dr1`, `spherex_dr1_deep`, `spherex_qr3`) y sus 6 bandas espectrales (`D1` a `D6`, de 0.75 a 5.00 µm).
  - Galería interactiva de vistas previas FITS renderizadas por versión de colección y por banda espectral.
- **Procesamiento de datos FITS nativo en el cliente:** Decodificación de archivos binarios FITS de NASA / IPAC IRSA con `DataView`, lectura big-endian y descompresión gzip transparente.
- **Visualización astronómica profesional:**
  - Escalas de flujo (stretching): `Asinh` (astronómico por defecto), `Logarítmico`, `Raíz cuadrada` y `Lineal`.
  - Paletas de color científico (colormaps): `Inferno`, `Viridis`, `Plasma`, `Magma` y `Escala de grises`.
  - Sustracción de luz zodiacal (extensión `ZODI` del archivo FITS).
  - Retícula / mira astronómica centrada sobre la coordenada consultada.
  - Zoom interactivo con restablecimiento.
- **Internacionalización Bilingüe (`ES` / `EN`):** Interfaz completa en Español e Inglés.
- **Exportación:** Descarga del recorte procesado en PNG y enlace directo para descargar el archivo FITS original.

## APIs públicas integradas
- **CDS Sesame Name Resolver (`SIMBAD` / `NED` / `VizieR`):** Resolución de nombres de cuerpos celestes a coordenadas ICRS y metadatos astronómicos.
- **IRSA SIA (Simple Image Access):** Consulta del catálogo de observaciones por coordenadas celestes en todas las versiones disponibles (`spherex_dr1`, `spherex_dr1_deep`, `spherex_qr3`).
- **IRSA IBE Cutouts:** Extracción y descarga de recortes FITS espectrales según coordenadas y dimensiones en grados.

## Cómo ejecutar

1. Instalar dependencias:
```powershell
npm install
```

2. Iniciar el servidor de desarrollo Vite:
```powershell
npm run dev
```
Abre `http://localhost:5173` en tu navegador.

3. Compilar para producción:
```powershell
npm run build
```
Los archivos optimizados se generarán en la carpeta `dist/`.
