import fs from "node:fs";
import path from "node:path";
import { toPascalCase, toCamelCase, type BindingFile, type EventDefinition } from "@eventgen/core";

function toGoFieldName(input: string): string {
  return toPascalCase(input);
}

function mapGo(t?: string): string {
  return t === "number" ? "float64"
    : t === "integer" ? "int64"
    : t === "boolean" ? "bool"
    : t === "array" ? "[]interface{}"
    : t === "object" ? "map[string]interface{}"
    : "string";
}

function jsonTag(fieldName: string): string {
  // Convert PascalCase to camelCase for JSON tags
  const cc = toCamelCase(fieldName);
  return cc.charAt(0).toLowerCase() + cc.slice(1);
}

function toLowerCamelCase(input: string): string {
  const s = toCamelCase(input);
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function generateGoSdk(input: { events: EventDefinition[]; bindings: BindingFile; outDir: string; modulePath?: string }) {
  const modulePath = input.modulePath ?? "github.com/company/generated-events-sdk";

  fs.mkdirSync(input.outDir, { recursive: true });

  fs.writeFileSync(
    path.join(input.outDir, "go.mod"),
    `module ${modulePath}\n\ngo 1.21\n\nrequire github.com/eventgen/runtime-go v0.1.0\n`
  );

  // Group events by domain
  const domainMap = new Map<string, Array<{ event: EventDefinition; typeName: string; publisherName: string; ctorName: string; methodName: string; pkg: string }>>();

  for (const event of input.events) {
    const typeName = `${toPascalCase(event.name)}Payload`;
    const publisherName = `${toPascalCase(event.name)}Publisher`;
    const ctorName = `New${toPascalCase(event.name)}Publisher`;
    const methodName = toPascalCase(event.name);
    const pkg = event.domain.toLowerCase();

    const pkgDir = path.join(input.outDir, pkg);
    fs.mkdirSync(pkgDir, { recursive: true });

    const props = Object.entries((event.payloadSchema.properties ?? {}) as Record<string, { type?: string }>);
    const fields = props.map(([k, v]) => {
      const goName = toGoFieldName(k);
      return `\t${goName} ${mapGo(v.type)} \`json:"${jsonTag(k)}"\``;
    }).join("\n");

    fs.writeFileSync(
      path.join(pkgDir, `${toCamelCase(event.name).replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, "")}.go`),
      `package ${pkg}

import (
\t"context"

\truntime "github.com/eventgen/runtime-go"
)

// ${typeName} is the typed payload for the ${event.id} event.
type ${typeName} struct {
${fields}
}

// ${publisherName} publishes ${typeName} events.
type ${publisherName} struct {
\ttransport runtime.TransportAdapter
}

func ${ctorName}(transport runtime.TransportAdapter) *${publisherName} {
\treturn &${publisherName}{transport: transport}
}

// Publish sends the payload to the configured transport.
func (p *${publisherName}) Publish(ctx context.Context, payload ${typeName}, opts ...runtime.PublishOption) (*runtime.PublishResult, error) {
\tenvelope := runtime.BuildEnvelope("${event.id}", "${event.version}", payload, opts...)
\treturn p.transport.Publish(ctx, envelope)
}
`
    );

    if (!domainMap.has(event.domain)) domainMap.set(event.domain, []);
    domainMap.get(event.domain)!.push({ event, typeName, publisherName, ctorName, methodName, pkg });
  }

  // Generate client.go with domain accessors
  const imports = [`\truntime "github.com/eventgen/runtime-go"`];
  const domainStructs: string[] = [];
  const domainMethods: string[] = [];
  const clientMethods: string[] = [];

  for (const [domain, entries] of domainMap) {
    const pkg = domain.toLowerCase();
    imports.push(`\t"${modulePath}/${pkg}"`);
    const structName = `${toPascalCase(domain)}Events`;

    const eventMethods = entries.map(({ ctorName, methodName, publisherName, pkg }) =>
      `func (e *${structName}) ${methodName}() *${pkg}.${publisherName} {\n\treturn ${pkg}.${ctorName}(e.transport)\n}`
    ).join("\n\n");

    domainStructs.push(`type ${structName} struct {\n\ttransport runtime.TransportAdapter\n}\n\n${eventMethods}`);
    domainMethods.push(`func (c *Client) ${toPascalCase(domain)}() *${structName} {\n\treturn &${structName}{transport: c.transport}\n}`);
  }

  fs.writeFileSync(
    path.join(input.outDir, "client.go"),
    `package events

import (
${[...new Set(imports)].join("\n")}
)

// Client is the entry point for publishing events.
type Client struct {
\ttransport runtime.TransportAdapter
}

// NewClient creates a new event client backed by the given transport.
func NewClient(transport runtime.TransportAdapter) *Client {
\treturn &Client{transport: transport}
}

${domainStructs.join("\n\n")}

${domainMethods.join("\n\n")}
`
  );
}
