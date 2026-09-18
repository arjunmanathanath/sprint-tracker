import { useEffect } from "react";
import { useStore } from "./store/useStore";
import { TabBar } from "./components/TabBar";
import { Onboarding } from "./screens/Onboarding";
import { Today } from "./screens/Today";
import { Progress } from "./screens/Progress";
import { Scratch } from "./screens/Scratch";
import { Settings } from "./screens/Settings";

export default function App() {
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const init = useStore((s) => s.init);
  const tab = useStore((s) => s.tab);
  const startDate = useStore((s) => s.config.startDate);
  const dismissError = useStore((s) => s.dismissError);

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted text-sm" aria-busy="true">
        Loading…
      </div>
    );
  }

  if (!startDate) return <Onboarding />;

  return (
    <>
      {error && (
        <button
          type="button"
          onClick={dismissError}
          className="fixed top-0 inset-x-0 z-50 bg-danger/90 text-bg text-xs px-4 py-2 text-center pt-safe"
        >
          {error} · tap to dismiss
        </button>
      )}
      {tab === "today" && <Today />}
      {tab === "progress" && <Progress />}
      {tab === "scratch" && <Scratch />}
      {tab === "settings" && <Settings />}
      <TabBar />
    </>
  );
}
