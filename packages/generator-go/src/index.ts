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
  const domainMap = new Map<string, Array<{ event: EventDefinition; typeName: string; publisherName: string; consumerName: string; handlerName: string; ctorName: string; consumerCtorName: string; methodName: string; pkg: string }>>();

  for (const event of input.events) {
    const typeName = `${toPascalCase(event.name)}Payload`;
    const publisherName = `${toPascalCase(event.name)}Publisher`;
    const consumerName = `${toPascalCase(event.name)}Consumer`;
    const handlerName = `${toPascalCase(event.name)}Handler`;
    const ctorName = `New${toPascalCase(event.name)}Publisher`;
    const consumerCtorName = `New${toPascalCase(event.name)}Consumer`;
    const methodName = toPascalCase(event.name);
    const pkg = event.domain.toLowerCase();

    const pkgDir = path.join(input.outDir, pkg);
    fs.mkdirSync(pkgDir, { recursive: true });

    const props = Object.entries((event.payloadSchema.properties ?? {}) as Record<string, { type?: string }>);
    const fields = props.map(([k, v]) => {
      const goName = toGoFieldName(k);
      return `\t${goName} ${mapGo(v.type)} \`json:"${jsonTag(k)}"\``;
    }).join("\n");
    const consumers = (event.consumers ?? []).map((consumer) => `"${consumer}"`).join(", ");

    fs.writeFileSync(
      path.join(pkgDir, `${toCamelCase(event.name).replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, "")}.go`),
      `package ${pkg}

import (
\t"context"
\t"encoding/json"
\t"fmt"

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

// ${handlerName} handles ${typeName} events.
type ${handlerName} func(ctx context.Context, payload ${typeName}, envelope runtime.EventEnvelope) error

// ${toPascalCase(event.name)}Consumers lists the declared consumers for the ${event.id} event.
var ${toPascalCase(event.name)}Consumers = []string{${consumers}}

// ${consumerName} routes ${event.id} envelopes to a typed handler.
type ${consumerName} struct {
\thandler ${handlerName}
}

func ${consumerCtorName}(handler ${handlerName}) *${consumerName} {
\treturn &${consumerName}{handler: handler}
}

func (c *${consumerName}) EventID() string { return "${event.id}" }
func (c *${consumerName}) Version() string { return "${event.version}" }
func (c *${consumerName}) Consumers() []string { return ${toPascalCase(event.name)}Consumers }

func (c *${consumerName}) Handle(ctx context.Context, envelope runtime.EventEnvelope) error {
\tif envelope.EventID != c.EventID() || envelope.Version != c.Version() {
\t\treturn fmt.Errorf("unexpected event envelope: %s@%s", envelope.EventID, envelope.Version)
\t}
\tpayload, ok := envelope.Payload.(${typeName})
\tif !ok {
\t\tencoded, err := json.Marshal(envelope.Payload)
\t\tif err != nil {
\t\t\treturn fmt.Errorf("marshal payload for %s: %w", c.EventID(), err)
\t\t}
\t\tif err := json.Unmarshal(encoded, &payload); err != nil {
\t\t\treturn fmt.Errorf("decode payload for %s: %w", c.EventID(), err)
\t\t}
\t}
\treturn c.handler(ctx, payload, envelope)
}
`
    );

    if (!domainMap.has(event.domain)) domainMap.set(event.domain, []);
    domainMap.get(event.domain)!.push({ event, typeName, publisherName, consumerName, handlerName, ctorName, consumerCtorName, methodName, pkg });
  }

  // Generate client.go with domain accessors
  const imports = [`\t"context"`, `\truntime "github.com/eventgen/runtime-go"`];
  const domainStructs: string[] = [];
  const domainMethods: string[] = [];
  const consumerHandlerStructs: string[] = [];
  const consumerRouteLines: string[] = [];

  for (const [domain, entries] of domainMap) {
    const pkg = domain.toLowerCase();
    imports.push(`\t"${modulePath}/${pkg}"`);
    const structName = `${toPascalCase(domain)}Events`;
    const consumerHandlersName = `${toPascalCase(domain)}ConsumerHandlers`;

    const eventMethods = entries.map(({ ctorName, methodName, publisherName, pkg }) =>
      `func (e *${structName}) ${methodName}() *${pkg}.${publisherName} {\n\treturn ${pkg}.${ctorName}(e.transport)\n}`
    ).join("\n\n");

    domainStructs.push(`type ${structName} struct {\n\ttransport runtime.TransportAdapter\n}\n\n${eventMethods}`);
    domainMethods.push(`func (c *Client) ${toPascalCase(domain)}() *${structName} {\n\treturn &${structName}{transport: c.transport}\n}`);
    const handlerFields = entries.map(({ methodName, handlerName, pkg }) => `\t${methodName} ${pkg}.${handlerName}`).join("\n");
    consumerHandlerStructs.push(`type ${consumerHandlersName} struct {\n${handlerFields}\n}`);
    consumerRouteLines.push(`\tif handlers.${toPascalCase(domain)} != nil {`);
    for (const { event, methodName, consumerCtorName, pkg } of entries) {
      consumerRouteLines.push(`\t\tif handlers.${toPascalCase(domain)}.${methodName} != nil {\n\t\t\troutes["${event.id}@${event.version}"] = ${pkg}.${consumerCtorName}(handlers.${toPascalCase(domain)}.${methodName}).Handle\n\t\t}`);
    }
    consumerRouteLines.push(`\t}`);
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

// Consumer routes incoming envelopes to typed event handlers.
type Consumer struct {
\troutes map[string]func(context.Context, runtime.EventEnvelope) error
}

type ConsumerHandlers struct {
${Array.from(domainMap.keys()).map((domain) => `\t${toPascalCase(domain)} *${toPascalCase(domain)}ConsumerHandlers`).join("\n")}
}

${consumerHandlerStructs.join("\n\n")}

func NewConsumer(handlers ConsumerHandlers) *Consumer {
\troutes := map[string]func(context.Context, runtime.EventEnvelope) error{}
${consumerRouteLines.join("\n")}
\treturn &Consumer{routes: routes}
}

func (c *Consumer) Handle(ctx context.Context, envelope runtime.EventEnvelope) (bool, error) {
\troute := c.routes[envelope.EventID+"@"+envelope.Version]
\tif route == nil {
\t\treturn false, nil
\t}
\tif err := route(ctx, envelope); err != nil {
\t\treturn true, err
\t}
\treturn true, nil
}
`
  );
}
