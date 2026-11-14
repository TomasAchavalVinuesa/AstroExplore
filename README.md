# SPHEREx Explorer — React + Vite & Tailwind CSS

Aplicación web desarrollada con **React 19**, **Vite**, **TypeScript** y **Tailwind CSS** para consultar, explorar y visualizar recortes de imágenes espectrales astronómicas de la misión **NASA SPHEREx** a partir de coordenadas celestes (**Ascensión Recta** y **Declinación** en grados decimales o formato sexagesimal `HMS`/`DMS`).

## Características
- **Tecnología moderna:** React + Vite + Tailwind CSS (rápido, sin dependencias pesadas de servidor).
- **Procesamiento de datos FITS nativo en el cliente:** Decodificación de archivos binarios FITS de NASA / IPAC IRSA con `DataView`, lectura big-endian y descompresión gzip transparente.
- **Visualización astronómica profesional:**
  - Escalas de flujo (stretching): `Asinh` (astronómico por defecto), `Logarítmico`, `Raíz cuadrada` y `Lineal`.
  - Paletas de color científico (colormaps): `Inferno`, `Viridis`, `Plasma`, `Magma` y `Escala de grises`.
  - Sustracción de luz zodiacal (extensión `ZODI` del archivo FITS).
  - Retícula / mira astronómica centrada sobre la coordenada consultada.
  - Zoom interactivo con restablecimiento.
- **Objetivos de prueba integrados:** Presets rápidos para Galaxia M101, Galaxia M51, Plano galáctico Vela/Carina, Campo profundo NEP y coordenadas sexagesimales.
- **Exportación:** Descarga del recorte procesado en PNG y enlace directo para descargar el archivo FITS original.

## APIs oficiales de NASA/IPAC IRSA
- **IRSA SIA (Simple Image Access):** Consulta del catálogo de observaciones por coordenadas celestes (`spherex_dr1`, `spherex_dr1_deep`, `spherex_qr3`).
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
