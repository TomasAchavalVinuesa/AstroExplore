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

## 🔄 Sincronización Automática con GitHub
Este proyecto cuenta con un sistema de sincronización automática en segundo plano:
- iniciar-auto-sync.bat: Inicia el monitor en segundo plano (detecta cambios y sube automáticamente a GitHub).
- detener-auto-sync.bat: Detiene el monitor en segundo plano.
- er-estado-auto-sync.bat: Muestra el estado del servicio y el registro de sincronizaciones (uto-sync.log).
- uto-commit-push.bat: Ejecuta un commit y push manual inmediato en 1 solo clic.
