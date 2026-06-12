"use client";
import { useState } from "react";

type Event = {
  id: string;
  version: string;
  name?: string;
  domain: string;
  description: string;
  tags?: string[];
  destination?: { provider: string };
  usage?: { typescript: string; java: string; python: string; go: string };
  payloadSchema?: unknown;
};

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
            {event.tags && event.tags.length > 0 && (
              <p className="tags">{event.tags.map((t) => <span key={t} className="tag">{t}</span>)}</p>
            )}
            <p><b>Destination:</b> {event.destination?.provider ?? "not-bound"}</p>
            <h3>TypeScript</h3>
            <pre>{event.usage?.typescript}</pre>
            <h3>Java</h3>
            <pre>{event.usage?.java}</pre>
            <h3>Python</h3>
            <pre>{event.usage?.python}</pre>
            <h3>Go</h3>
            <pre>{event.usage?.go}</pre>
            <h3>Payload Schema</h3>
            <pre>{JSON.stringify(event.payloadSchema, null, 2)}</pre>
          </article>
        ))}
      </div>
    </>
  );
}
