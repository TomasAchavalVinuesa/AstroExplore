import React, { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

interface ShareButtonProps {
  ra: string;
  dec: string;
  collection: string;
  band: string;
  size: string;
  stretch: string;
  colormap: string;
  subtractZodi: boolean;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  ra,
  dec,
  collection,
  band,
  size,
  stretch,
  colormap,
  subtractZodi,
}) => {
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("ra", ra);
    url.searchParams.set("dec", dec);
    url.searchParams.set("collection", collection);
    url.searchParams.set("band", band);
    url.searchParams.set("size", size);
    url.searchParams.set("stretch", stretch);
    url.searchParams.set("colormap", colormap);
    url.searchParams.set("subtract_zodi", String(subtractZodi));

    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(
        language === "en"
          ? "Copy this permalink to share your search:"
          : "Copia este enlace para compartir tu búsqueda:",
        url.toString()
      );
    }
  };

  const isEn = language === "en";

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleShare}
        className={`w-full py-2 px-3 rounded-xl border transition-all text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] ${
          copied
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
            : "bg-cyan-950/40 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400/50"
        }`}
        title={
          isEn
            ? "Copy permalink with coordinates and display settings"
            : "Copiar enlace permanente con estas coordenadas y ajustes"
        }
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isEn ? "Permalink Copied to Clipboard!" : "¡Enlace Permanente Copiado!"}</span>
          </>
        ) : (
          <>
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isEn ? "Share Observation Link" : "Compartir Enlace de Observación"}</span>
          </>
        )}
      </button>
    </div>
  );
};
