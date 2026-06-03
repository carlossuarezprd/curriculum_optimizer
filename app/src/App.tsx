import { useState } from "react";
import { Pool } from "./components/Pool";
import { Board } from "./components/Board";
import { StatusPanel } from "./components/StatusPanel";
import { CourseModal } from "./components/CourseModal";
import { Course } from "./types";

export default function App() {
  const [selected, setSelected] = useState<Course | null>(null);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex items-baseline gap-3">
          <div className="h-5 w-1.5 rounded-full bg-maroon" />
          <h1 className="text-base font-semibold tracking-tight text-ink">Booth Curriculum Optimizer</h1>
          <span className="hidden text-xs text-ink-muted sm:inline">
            plan six quarters · check requirements · simulate bidding
          </span>
        </div>
        <div className="text-right text-[11px] leading-tight text-ink-muted">
          <div>Created by Carlos Suarez</div>
          <a href="mailto:csuarezp@chicagobooth.edu" className="hover:text-maroon">csuarezp@chicagobooth.edu</a>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_1fr_300px]">
        <aside className="hidden min-h-0 border-r border-gray-200 bg-white lg:block">
          <Pool onSelect={setSelected} />
        </aside>

        <section className="min-h-0 overflow-y-auto p-4">
          <Board />
        </section>

        <aside className="hidden min-h-0 border-l border-gray-200 bg-white lg:block">
          <StatusPanel />
        </aside>
      </main>

      {/* Mobile note: the three-pane layout is designed for desktop in this MVP. */}
      <div className="border-t border-gray-200 bg-white px-4 py-2 text-center text-[11px] text-gray-300 lg:hidden">
        Open on a wider screen to use the catalog and status panels.
      </div>

      {selected && <CourseModal course={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
