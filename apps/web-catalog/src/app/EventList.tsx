"use client";
import { useState } from "react";

type Event = {
  id: string;
  version: string;
  name?: string;
  domain: string;
  description: string;
  producer?: string;
  consumers?: string[];
  tags?: string[];
  destination?: { provider: string };
  usage?: { typescript: string; java: string; python: string; go: string };
  consumerUsage?: { typescript: string; java: string; python: string; go: string };
  payloadSchema?: unknown;
};

const languageRows = [
  ["TypeScript", "typescript"],
  ["Java", "java"],
  ["Python", "python"],
  ["Go", "go"],
] as const;

export function EventList({ events }: { events: Event[] }) {
  const [query, setQuery] = useState("");

  const q = query.toLowerCase();
  const filtered = q
    ? events.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          (e.name ?? "").toLowerCase().includes(q) ||
          e.domain.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.producer ?? "").toLowerCase().includes(q) ||
          (e.consumers ?? []).some((consumer) => consumer.toLowerCase().includes(q)) ||
          (e.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    : events;

  return (
    <>
      <input
        className="search"
        type="search"
        placeholder="Buscar por nombre, dominio, id o tag…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar eventos"
      />
      {filtered.length === 0 && (
        <p className="empty">No se encontraron eventos para &ldquo;{query}&rdquo;.</p>
      )}
      <div className="grid">
        {filtered.map((event) => (
          <article className="card" key={`${event.id}@${event.version}`}>
            <h2>{event.id}</h2>
            <p>{event.description}</p>
            <p><b>Version:</b> {event.version}</p>
            <p><b>Domain:</b> {event.domain}</p>
            <p><b>Producer:</b> {event.producer ?? "not-declared"}</p>
            <div className="field-group">
              <b>Consumers:</b>
              {event.consumers && event.consumers.length > 0 ? (
                <span className="tags inline-tags">
                  {event.consumers.map((consumer) => <span key={consumer} className="tag consumer">{consumer}</span>)}
                </span>
              ) : (
                <span className="muted"> not-declared</span>
              )}
            </div>
            {event.tags && event.tags.length > 0 && (
              <p className="tags">{event.tags.map((t) => <span key={t} className="tag">{t}</span>)}</p>
            )}
            <p><b>Destination:</b> {event.destination?.provider ?? "not-bound"}</p>
            {languageRows.map(([label, key]) => (
              <section className="usage-section" key={key}>
                <h3>{label}</h3>
                <p className="usage-label">Publish</p>
                <pre>{event.usage?.[key]}</pre>
                <p className="usage-label">Consume</p>
                <pre>{event.consumerUsage?.[key] ?? "not-generated"}</pre>
              </section>
            ))}
            <h3>Payload Schema</h3>
            <pre>{JSON.stringify(event.payloadSchema, null, 2)}</pre>
          </article>
        ))}
      </div>
    </>
  );
}
