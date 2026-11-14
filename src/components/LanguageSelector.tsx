import React from "react";
import { Globe } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="inline-flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-inner text-xs"
      role="group"
      aria-label={t.navbar.languageAriaLabel}
    >
      <div className="pl-1.5 pr-1 flex items-center text-cyan-400" title={t.navbar.selectLanguage}>
        <Globe className="w-3.5 h-3.5" />
      </div>

      <button
        type="button"
        onClick={() => setLanguage("es")}
        aria-pressed={language === "es"}
        title={t.navbar.spanish}
        className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-all duration-150 cursor-pointer ${
          language === "es"
            ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/30"
            : "text-slate-300 hover:text-white hover:bg-slate-800/80"
        }`}
      >
        ES
      </button>

      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        title={t.navbar.english}
        className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-all duration-150 cursor-pointer ${
          language === "en"
            ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/30"
            : "text-slate-300 hover:text-white hover:bg-slate-800/80"
        }`}
      >
        EN
      </button>
    </div>
  );
};

