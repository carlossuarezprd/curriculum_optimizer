import { useEffect, useState } from "react";
import { Pool } from "./components/Pool";
import { Board } from "./components/Board";
import { StatusPanel } from "./components/StatusPanel";
import { CourseModal } from "./components/CourseModal";
import { FlagshipModal } from "./components/FlagshipModal";
import { usePlan } from "./store";
import { Course } from "./types";

export default function App() {
  const [selected, setSelected] = useState<Course | null>(null);
  const [showFlagship, setShowFlagship] = useState(false);
  const notice = usePlan((s) => s.notice);
  const setNotice = usePlan((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  return (
    <div className="flex h-screen flex-col bg-bg text-txt">
      {/* UChicago Booth maroon header band */}
      <header className="flex items-center justify-between bg-maroon px-5 py-3 shadow-lg">
        <div className="flex items-baseline gap-3">
          <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-white">Chicago Booth</span>
          <span className="h-4 w-px bg-white/30" />
          <h1 className="text-base font-semibold tracking-tight text-white">Curriculum Optimizer</h1>
          <span className="hidden text-xs text-white/70 lg:inline">plan six quarters · check requirements · simulate bidding</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFlagship(true)}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/25 hover:bg-white/20"
          >★ Flagship courses</button>
          <div className="hidden text-right text-[11px] leading-tight text-white/80 sm:block">
            <div>Created by Carlos Suarez</div>
            <a href="mailto:csuarezp@chicagobooth.edu" className="hover:text-white">csuarezp@chicagobooth.edu</a>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_1fr_300px]">
        <aside className="hidden min-h-0 border-r border-line lg:block"><Pool onSelect={setSelected} /></aside>
        <section className="min-h-0 overflow-y-auto p-4"><Board onOpenCourse={setSelected} /></section>
        <aside className="hidden min-h-0 border-l border-line lg:block"><StatusPanel /></aside>
      </main>

      <div className="border-t border-line bg-surface px-4 py-2 text-center text-[11px] text-muted/60 lg:hidden">
        Open on a wider screen to use the catalog and status panels.
      </div>

      {selected && <CourseModal course={selected} onClose={() => setSelected(null)} />}
      {showFlagship && <FlagshipModal onClose={() => setShowFlagship(false)} />}

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-surface2 px-4 py-2 text-sm text-txt shadow-xl ring-1 ring-line">
          {notice}
        </div>
      )}
    </div>
  );
}
