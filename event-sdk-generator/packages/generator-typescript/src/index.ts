import fs from "node:fs";
import path from "node:path";
import { toCamelCase, toPascalCase, type BindingFile, type EventDefinition } from "@eventgen/core";

export function generateTypeScriptSdk(input: { events: EventDefinition[]; bindings: BindingFile; outDir: string }) {
  fs.mkdirSync(path.join(input.outDir, "src", "events"), { recursive: true });
  fs.writeFileSync(
    path.join(input.outDir, "package.json"),
    JSON.stringify({ name: "@company/generated-events-sdk", version: "0.1.0", type: "module", dependencies: { "@eventgen/runtime-typescript": "^0.1.0" } }, null, 2)
  );
  fs.writeFileSync(
    path.join(input.outDir, "src", "runtime.ts"),
    `export type { TransportAdapter, EventEnvelope, PublishResult } from "@eventgen/runtime-typescript";\nexport { buildEnvelope } from "@eventgen/runtime-typescript";\n`
  );

  // Group events by domain to build the nested client structure
  const domainMap = new Map<string, Array<{ event: EventDefinition; factoryFn: string; eventKey: string; fileName: string; typeName: string }>>();

  for (const event of input.events) {
    const rawKey = toCamelCase(event.name);
    const eventKey = rawKey.charAt(0).toLowerCase() + rawKey.slice(1);
    const typeName = `${toPascalCase(event.domain)}${toPascalCase(event.name)}Payload`;
    const factoryFn = `create${toPascalCase(event.domain)}${toPascalCase(event.name)}`;
    const fileName = `${event.id.replaceAll(".", "-")}.ts`;
    const file = path.join(input.outDir, "src", "events", fileName);
    const props = Object.entries((event.payloadSchema.properties ?? {}) as Record<string, { type?: string }>)
      .map(([k, v]) => `  ${k}: ${mapTs(v.type)};`)
      .join("\n");

    fs.writeFileSync(
      file,
      `import type { TransportAdapter, PublishResult } from "../runtime";
import { buildEnvelope } from "../runtime";

export type ${typeName} = {
${props}
};

export function ${factoryFn}(transport: TransportAdapter) {
  return {
    publish(payload: ${typeName}, traceId?: string): Promise<PublishResult> {
      return transport.publish(buildEnvelope("${event.id}", "${event.version}", payload, traceId));
    }
  };
}
`
    );

    if (!domainMap.has(event.domain)) domainMap.set(event.domain, []);
    domainMap.get(event.domain)!.push({ event, factoryFn, eventKey, fileName, typeName });
  }

  // Generate index.ts with createClient factory
  const importLines: string[] = [];
  const typeExportLines: string[] = [];
  const domainEntries: string[] = [];

  for (const [domain, entries] of domainMap) {
    for (const { factoryFn, fileName, typeName } of entries) {
      const modulePath = `./events/${fileName.replace(/\.ts$/, "")}`;
      importLines.push(`import { ${factoryFn}, type ${typeName} } from "${modulePath}";`);
      typeExportLines.push(`export type { ${typeName} } from "${modulePath}";`);
    }
    const eventEntries = entries.map(({ eventKey, factoryFn }) => `      ${eventKey}: ${factoryFn}(transport),`).join("\n");
    domainEntries.push(`    ${domain}: {\n${eventEntries}\n    },`);
  }

  const indexContent = `import type { TransportAdapter } from "./runtime";
${importLines.join("\n")}

export type { TransportAdapter, PublishResult } from "./runtime";
${typeExportLines.join("\n")}

export function createClient(transport: TransportAdapter) {
  return {
${domainEntries.join("\n")}
  };
}
`;

  fs.writeFileSync(path.join(input.outDir, "src", "index.ts"), indexContent);
}

function mapTs(t?: string) {
  return t === "number" || t === "integer" ? "number"
    : t === "boolean" ? "boolean"
    : t === "array" ? "unknown[]"
    : t === "object" ? "Record<string, unknown>"
    : "string";
}
