import React from "react";
import { ExternalLink, Sparkles } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";

export const Navbar: React.FC = () => {
  const { t } = useLanguage();

  return (
    <header className="border-b border-slate-800 bg-space-900/90 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-6 py-3.5">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-600 to-indigo-600 shadow-lg shadow-cyan-500/20 text-white font-extrabold tracking-wider text-xs shrink-0">
            SPHEREx
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                {t.navbar.title}
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded-full">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                {t.navbar.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {t.navbar.subtitle}
            </p>
          </div>
        </div>

        {/* Zona derecha de la barra superior: enlaces y selector de idioma */}
        <div className="flex items-center gap-2 text-xs flex-wrap self-end md:self-auto">
          <a
            href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            <span>{t.navbar.missionLink}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <a
            href="https://caltech-ipac.github.io/irsa-tutorials/spherex/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            <span>{t.navbar.tutorialsLink}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>

          {/* Selector de idioma */}
          <div className="ml-1">
            <LanguageSelector />
          </div>
        </div>
      </div>
    </header>
  );
};
