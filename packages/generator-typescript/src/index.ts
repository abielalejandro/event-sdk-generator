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
    `export type { TransportAdapter, EventEnvelope, PublishResult, FifoOptions, PublishOptions } from "@eventgen/runtime-typescript";\nexport { buildEnvelope } from "@eventgen/runtime-typescript";\n`
  );

  // Group events by domain to build the nested client structure
  const domainMap = new Map<string, Array<{ event: EventDefinition; factoryFn: string; consumerFactoryFn: string; eventKey: string; fileName: string; typeName: string; handlerTypeName: string }>>();

  for (const event of input.events) {
    const rawKey = toCamelCase(event.name);
    const eventKey = rawKey.charAt(0).toLowerCase() + rawKey.slice(1);
    const typeName = `${toPascalCase(event.domain)}${toPascalCase(event.name)}Payload`;
    const handlerTypeName = `${toPascalCase(event.domain)}${toPascalCase(event.name)}Handler`;
    const factoryFn = `create${toPascalCase(event.domain)}${toPascalCase(event.name)}`;
    const consumerFactoryFn = `create${toPascalCase(event.domain)}${toPascalCase(event.name)}Consumer`;
    const fileName = `${event.id.replaceAll(".", "-")}.ts`;
    const file = path.join(input.outDir, "src", "events", fileName);
    const props = Object.entries((event.payloadSchema.properties ?? {}) as Record<string, { type?: string }>)
      .map(([k, v]) => `  ${k}: ${mapTs(v.type)};`)
      .join("\n");
    const consumerNamesConst = JSON.stringify(event.consumers ?? []);

    fs.writeFileSync(
      file,
      `import type { TransportAdapter, EventEnvelope, PublishResult, PublishOptions } from "../runtime";
import { buildEnvelope } from "../runtime";

export type ${typeName} = {
${props}
};

export type ${handlerTypeName} = (payload: ${typeName}, envelope: EventEnvelope) => void | Promise<void>;
export const ${factoryFn}ConsumerNames = ${consumerNamesConst} as const;
export type ${factoryFn}ConsumerName = typeof ${factoryFn}ConsumerNames[number];

export function ${factoryFn}(transport: TransportAdapter) {
  return {
    publish(payload: ${typeName}, opts?: string | PublishOptions): Promise<PublishResult> {
      return transport.publish(buildEnvelope("${event.id}", "${event.version}", payload, opts));
    }
  };
}

export function ${consumerFactoryFn}(handler: ${handlerTypeName}) {
  return {
    eventId: "${event.id}",
    version: "${event.version}",
    consumers: ${factoryFn}ConsumerNames,
    async handle(envelope: EventEnvelope): Promise<void> {
      if (envelope.eventId !== "${event.id}" || envelope.version !== "${event.version}") {
        throw new Error(\`Unexpected event envelope: \${envelope.eventId}@\${envelope.version}\`);
      }
      await handler(envelope.payload as ${typeName}, envelope);
    }
  };
}
`
    );

    if (!domainMap.has(event.domain)) domainMap.set(event.domain, []);
    domainMap.get(event.domain)!.push({ event, factoryFn, consumerFactoryFn, eventKey, fileName, typeName, handlerTypeName });
  }

  // Generate index.ts with createClient factory
  const importLines: string[] = [];
  const typeExportLines: string[] = [];
  const domainEntries: string[] = [];
  const consumerHandlerTypes: string[] = [];
  const consumerRouteEntries: string[] = [];

  for (const [domain, entries] of domainMap) {
    for (const { factoryFn, consumerFactoryFn, fileName, typeName, handlerTypeName } of entries) {
      const modulePath = `./events/${fileName.replace(/\.ts$/, "")}`;
      importLines.push(`import { ${factoryFn}, ${consumerFactoryFn}, type ${handlerTypeName}, type ${typeName} } from "${modulePath}";`);
      typeExportLines.push(`export type { ${handlerTypeName}, ${typeName} } from "${modulePath}";`);
    }
    const eventEntries = entries.map(({ eventKey, factoryFn }) => `      ${eventKey}: ${factoryFn}(transport),`).join("\n");
    domainEntries.push(`    ${domain}: {\n${eventEntries}\n    },`);
    const handlerEntries = entries.map(({ eventKey, handlerTypeName }) => `    ${eventKey}?: ${handlerTypeName};`).join("\n");
    consumerHandlerTypes.push(`  ${domain}?: {\n${handlerEntries}\n  };`);
    const routeEntries = entries
      .map(({ event, eventKey, consumerFactoryFn }) => `  if (handlers.${domain}?.${eventKey}) routes.set("${event.id}@${event.version}", ${consumerFactoryFn}(handlers.${domain}.${eventKey}).handle);`)
      .join("\n");
    consumerRouteEntries.push(routeEntries);
  }

  const indexContent = `import type { EventEnvelope, TransportAdapter } from "./runtime";
${importLines.join("\n")}

export type { EventEnvelope, TransportAdapter, PublishResult } from "./runtime";
${typeExportLines.join("\n")}

export function createClient(transport: TransportAdapter) {
  return {
${domainEntries.join("\n")}
  };
}

export type EventConsumerHandlers = {
${consumerHandlerTypes.join("\n")}
};

export function createConsumer(handlers: EventConsumerHandlers) {
  const routes = new Map<string, (envelope: EventEnvelope) => Promise<void>>();
${consumerRouteEntries.join("\n")}

  return {
    async handle(envelope: EventEnvelope): Promise<boolean> {
      const route = routes.get(\`\${envelope.eventId}@\${envelope.version}\`);
      if (!route) return false;
      await route(envelope);
      return true;
    }
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
