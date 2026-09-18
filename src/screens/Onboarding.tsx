import { useState } from "react";
import { useStore } from "../store/useStore";
import { defaultStartDateISO, dayOfWeek, formatLong } from "../logic/dates";
import { Button, Card } from "../components/ui";

/** First launch: pick the sprint start date (week 1, day 1). Default = next Sunday. */
export function Onboarding() {
  const setConfig = useStore((s) => s.setConfig);
  const [date, setDate] = useState(defaultStartDateISO());
  const notSunday = dayOfWeek(date) !== 0;

  return (
    <main className="mx-auto max-w-md min-h-dvh flex flex-col px-5 pt-safe">
      <div className="flex-1 flex flex-col justify-center py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">Sprint Tracker</p>
        <h1 className="text-2xl font-semibold leading-tight">When does your sprint start?</h1>
        <p className="text-sm text-muted mt-2">
          Week 1 begins on this day. The plan runs 6 h on weekdays, 4.5 h on Tuesdays and 11 h on
          weekends — 50.5 h a week. Java refresher runs for the first 4 weeks, then Architecture
          takes its time.
        </p>

        <Card className="mt-6 p-4">
          <label className="block text-xs text-muted mb-1" htmlFor="start-date">
            Start date
          </label>
          <input
            id="start-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-full bg-transparent text-lg font-medium outline-none py-2 tabular"
          />
          <p className="text-sm mt-1">{formatLong(date)}</p>
          {notSunday && (
            <p className="text-xs text-warn mt-2">
              Weeks run Sunday to Saturday, so a Sunday start keeps sprint weeks and calendar weeks aligned.
              Any day works though.
            </p>
          )}
        </Card>

        <Button
          variant="primary"
          className="mt-6 w-full min-h-12"
          onClick={() => {
            setConfig({ startDate: date });
            // Ask the browser not to evict our IndexedDB under storage pressure. Installed PWAs
            // and engaged sites get this silently; it is also offered again in Settings.
            void navigator.storage?.persist?.().catch(() => undefined);
          }}
        >
          Start sprint
        </Button>
        <p className="text-xs text-muted mt-3 text-center">You can change this later in Settings.</p>
      </div>
    </main>
  );
}
