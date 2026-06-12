import fs from "node:fs";
import path from "node:path";
import AjvLib from "ajv";

export type EventDefinition = {
  id: string;
  version: string;
  domain: string;
  name: string;
  description: string;
  producer?: string;
  consumers?: string[];
  tags?: string[];
  payloadSchema: Record<string, unknown>;
  examples?: unknown[];
};

export type BindingFile = {
  environment: string;
  bindings: Array<{
    eventId: string;
    version: string;
    destination: Record<string, unknown> & { provider: string };
  }>;
};

export type Catalog = {
  generatedAt: string;
  environment: string;
  events: Array<EventDefinition & { destination?: BindingFile["bindings"][number]["destination"]; usage: { typescript: string; java: string } }>;
};

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function walkJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry: fs.Dirent) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkJsonFiles(full) : entry.name.endsWith(".json") ? [full] : [];
  });
}

export function loadEventDefinitions(dir: string): EventDefinition[] {
  return walkJsonFiles(dir).map((file) => readJson<EventDefinition>(file));
}

const eventDefinitionSchema = {
  type: "object",
  required: ["id", "version", "domain", "name", "description", "payloadSchema"],
  properties: {
    id: { type: "string" }, version: { type: "string" }, domain: { type: "string" }, name: { type: "string" }, description: { type: "string" },
    producer: { type: "string" }, consumers: { type: "array", items: { type: "string" } }, tags: { type: "array", items: { type: "string" } },
    payloadSchema: { type: "object" }, examples: { type: "array" }
  }
};

export function validateDefinitions(events: EventDefinition[]): string[] {
  // AJV 8.x default export requires this cast under NodeNext moduleResolution
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ajv = new (AjvLib as any)({ allErrors: true, strict: false });
  const validate = ajv.compile(eventDefinitionSchema);
  const errors: string[] = [];
  for (const event of events) {
    const id = event.id ?? "unknown";
    if (!validate(event)) {
      errors.push(`${id}: ${ajv.errorsText(validate.errors)}`);
      continue;
    }
    // Gap D: validate payloadSchema is actually valid JSON Schema
    try {
      ajv.compile(event.payloadSchema);
    } catch (err) {
      errors.push(`${id}: payloadSchema is not valid JSON Schema — ${String(err)}`);
    }
  }
  return errors;
}

export function validateBindings(bindings: BindingFile, events: EventDefinition[]): string[] {
  const knownEvents = new Set(events.map((e) => `${e.id}@${e.version}`));
  const errors: string[] = [];
  for (const binding of bindings.bindings) {
    const key = `${binding.eventId}@${binding.version}`;
    if (!knownEvents.has(key)) {
      errors.push(`binding references unknown event: ${binding.eventId} v${binding.version} (not found in definitions)`);
    }
    if (!binding.destination.provider) {
      errors.push(`binding for ${binding.eventId} v${binding.version}: missing destination.provider`);
    }
  }
  return errors;
}

export function buildCatalog(events: EventDefinition[], bindings: BindingFile): Catalog {
  return {
    generatedAt: new Date().toISOString(),
    environment: bindings.environment,
    events: events.map((event) => {
      const binding = bindings.bindings.find((b) => b.eventId === event.id && b.version === event.version);
      return {
        ...event,
        destination: binding?.destination,
        usage: {
          typescript: `await client.${event.domain}.${toLowerCamelCase(event.name)}.publish(payload);`,
          java: `client.${event.domain}().${toLowerCamelCase(event.name)}().publish(payload);`
        }
      };
    })
  };
}

export function toCamelCase(input: string): string {
  return input.replace(/[-_. ]+(.)/g, (_, c: string) => c.toUpperCase());
}

function toLowerCamelCase(input: string): string {
  const s = toCamelCase(input);
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function toPascalCase(input: string): string {
  const camel = toCamelCase(input);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
