# SPHEREx Explorer — Next.js + TypeScript

Aplicación web desarrollada con **Next.js (App Router)**, **TypeScript** y **Node.js** para consultar y visualizar recortes de imágenes espectrales de **NASA SPHEREx** ingresando coordenadas celestes (**Ascensión Recta** y **Declinación** en grados decimales o formato sexagesimal `HMS`/`DMS`).

## APIs de IRSA utilizadas
- **IRSA SIA:** `https://irsa.ipac.caltech.edu/SIA` (`COLLECTION=spherex_dr1`, `spherex_dr1_deep`, `spherex_qr3`)
- **IRSA IBE Cutouts:** `{access_url}?center={RA},{Dec}d&size={SIZE}`

## Cómo ejecutar
```powershell
npm install
npm run dev
```
Luego abre `http://localhost:3000` en tu navegador.
