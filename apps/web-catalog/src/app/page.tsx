import { EventList } from "./EventList";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

async function getCatalog() {
  const candidates = [
    path.join(process.cwd(), "public", "catalog.json"),
    path.join(process.cwd(), "apps", "web-catalog", "public", "catalog.json")
  ];

  for (const catalogPath of candidates) {
    try {
      return JSON.parse(await fs.readFile(catalogPath, "utf8"));
    } catch {
      // Try the next known monorepo layout.
    }
  }

  return { generatedAt: null, environment: "unknown", events: [] };
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
