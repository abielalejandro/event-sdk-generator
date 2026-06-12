import { EventList } from "./EventList";

async function getCatalog() {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/catalog.json`, { cache: "no-store" });
    return await res.json();
  } catch {
    return { generatedAt: null, environment: "unknown", events: [] };
  }
}

export default async function Home() {
  const catalog = await getCatalog();
  return (
    <main className="container">
      <header>
        <h1>Event Catalog</h1>
        <p>Eventos async definidos y ejemplos de uso.</p>
      </header>
      <section className="meta">
        Environment: <b>{catalog.environment}</b> · Events: <b>{catalog.events.length}</b>
      </section>
      <EventList events={catalog.events} />
    </main>
  );
}
