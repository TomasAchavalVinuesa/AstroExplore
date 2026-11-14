import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy local para sortear restricciones de CORS hacia las APIs de NASA IRSA
      "/irsa-proxy": {
        target: "https://irsa.ipac.caltech.edu",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/irsa-proxy/, ""),
      },
      // Proxy de respaldo para el resolvedor de nombres astronómicos CDS Sesame (SIMBAD/NED/VizieR)
      "/sesame-proxy": {
        target: "https://cds.unistra.fr",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sesame-proxy/, ""),
      },
    },
  },
});

