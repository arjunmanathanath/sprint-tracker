import { useStore, type Tab } from "../store/useStore";
import { IconProgress, IconScratch, IconSettings, IconToday } from "./Icons";

const TABS: { id: Tab; label: string; Icon: typeof IconToday }[] = [
  { id: "today", label: "Today", Icon: IconToday },
  { id: "progress", label: "Progress", Icon: IconProgress },
  { id: "scratch", label: "Scratch", Icon: IconScratch },
  { id: "settings", label: "Settings", Icon: IconSettings },
];

export function TabBar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto max-w-md grid grid-cols-4">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2 min-h-14 text-[11px] font-medium transition ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
