import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPHEREx Explorer — Consulta por Coordenadas (IRSA API)",
  description:
    "Consulta y visualización de imágenes espectrales de NASA SPHEREx vía IRSA SIA & IBE Cutouts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
