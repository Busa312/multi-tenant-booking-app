import { useRef, useState } from "react";
import { BookingButton, BookingWidget, type BookingWidgetRef } from "@booking/widget-react";

interface DemoAppProps {
  site: string;
}

/** The React SDK on the stand-in salon site: every component and option worth trying. */
export function DemoApp({ site }: DemoAppProps) {
  const [locale, setLocale] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<string[]>([]);
  const small = useRef<BookingWidgetRef>(null);

  // A new function every render on purpose: the widget must not reload for it.
  const onBooked = ({ startAt }: { startAt: string }) =>
    setEvents((current) => [`${new Date().toLocaleTimeString()}  booked — starts ${startAt}`, ...current]);

  return (
    <>
      <header className="site-header">
        <span className="logo">Studio Lumière</span>
        <nav>
          <a href="/">Script version</a>
          <BookingButton className="own-button" site={site} locale={locale} onBooked={onBooked}>
            Our own &quot;Book now&quot; button
          </BookingButton>
        </nav>
      </header>

      <main>
        <section className="hero">
          <h1>The React SDK</h1>
          <p>
            <code>@booking/widget-react</code> against <code>{site}</code>.
          </p>
          <label className="locale">
            Widget language
            <select value={locale ?? ""} onChange={(event) => setLocale(event.target.value || undefined)}>
              <option value="">Salon&apos;s main language</option>
              <option value="en">English</option>
              <option value="ka">ქართული</option>
              <option value="ru">Русский</option>
            </select>
          </label>
        </section>

        <section className="block">
          <h2>Small widget</h2>
          <p className="note">
            With a <code>ref</code>: <button type="button" onClick={() => small.current?.open()}>open its booking flow</button>
          </p>
          <BookingWidget ref={small} className="narrow" site={site} size="small" locale={locale} onBooked={onBooked} />
        </section>

        <section className="block columns">
          <div>
            <h2>Medium widget</h2>
            <p className="note">&quot;Book&quot; opens the full flow over this page.</p>
          </div>
          <BookingWidget site={site} size="medium" locale={locale} onBooked={onBooked} />
        </section>

        <section className="block">
          <h2>Full page widget</h2>
          <BookingWidget site={site} size="full" locale={locale} onBooked={onBooked} />
        </section>

        <section className="block">
          <h2>Events</h2>
          <ol className="log">
            {events.map((event) => (
              <li key={event}>{event}</li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
