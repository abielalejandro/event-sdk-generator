import fs from "node:fs";
import path from "node:path";
import { toCamelCase, toPascalCase, type BindingFile, type EventDefinition } from "@eventgen/core";

function toSnakeCase(input: string): string {
  return toCamelCase(input)
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

function mapPython(t?: string): string {
  return t === "number" ? "Decimal"
    : t === "integer" ? "int"
    : t === "boolean" ? "bool"
    : t === "array" ? "list"
    : t === "object" ? "dict"
    : "str";
}

function needsDecimal(props: Record<string, { type?: string }>): boolean {
  return Object.values(props).some((v) => v.type === "number");
}

export function generatePythonSdk(input: { events: EventDefinition[]; bindings: BindingFile; outDir: string; packageName?: string }) {
  const pkgName = input.packageName ?? "company_events";
  const pkgDir = path.join(input.outDir, pkgName);
  const eventsDir = path.join(pkgDir, "events");
  fs.mkdirSync(eventsDir, { recursive: true });

  fs.writeFileSync(
    path.join(input.outDir, "pyproject.toml"),
    `[build-system]\nrequires = ["hatchling"]\nbuild-backend = "hatchling.build"\n\n[project]\nname = "${pkgName.replace(/_/g, "-")}"\nversion = "0.1.0"\nrequires-python = ">=3.11"\ndependencies = ["eventgen-runtime-python>=0.1.0"]\n\n[tool.hatch.build.targets.wheel]\npackages = ["${pkgName}"]\n`
  );

  // Group events by domain
  const domainMap = new Map<string, Array<{ event: EventDefinition; className: string; publisherClass: string; methodName: string; moduleName: string }>>();

  for (const event of input.events) {
    const eventName = event.id.split(".").slice(1).join(".");
    const className = `${toPascalCase(event.domain)}${toPascalCase(event.name)}Payload`;
    const publisherClass = `_${toPascalCase(event.domain)}${toPascalCase(event.name)}Publisher`;
    const methodName = toSnakeCase(event.name);
    const moduleName = event.id.replaceAll(".", "_");
    const props = Object.entries((event.payloadSchema.properties ?? {}) as Record<string, { type?: string }>);
    const hasDecimal = needsDecimal(Object.fromEntries(props));

    const decimalImport = hasDecimal ? "\nfrom decimal import Decimal" : "";
    const fields = props.map(([k, v]) => `    ${toSnakeCase(k)}: ${mapPython(v.type)}`).join("\n");

    fs.writeFileSync(
      path.join(eventsDir, `${moduleName}.py`),
      `from __future__ import annotations
from dataclasses import dataclass${decimalImport}
from eventgen_runtime import TransportAdapter, PublishResult, build_envelope


@dataclass
class ${className}:
${fields}


class ${publisherClass}:
    def __init__(self, transport: TransportAdapter) -> None:
        self._transport = transport

    async def publish(
        self,
        payload: ${className},
        trace_id: str | None = None,
    ) -> PublishResult:
        return await self._transport.publish(
            build_envelope("${event.id}", "${event.version}", payload.__dict__, trace_id)
        )
`
    );

    if (!domainMap.has(event.domain)) domainMap.set(event.domain, []);
    domainMap.get(event.domain)!.push({ event, className, publisherClass, methodName, moduleName });
  }

  // Generate __init__.py with create_client factory
  const allImports: string[] = [];
  const allExports: string[] = [];
  const domainClasses: string[] = [];
  const domainProperties: string[] = [];

  for (const [domain, entries] of domainMap) {
    const domainClass = `_${toPascalCase(domain)}Events`;
    const eventProperties = entries.map(({ publisherClass, methodName, moduleName }) => {
      allImports.push(`from ${pkgName}.events.${moduleName} import ${publisherClass}`);
      return `    @property\n    def ${methodName}(self) -> ${publisherClass}:\n        return ${publisherClass}(self._transport)`;
    }).join("\n\n");

    for (const { className, moduleName } of entries) {
      allImports.push(`from ${pkgName}.events.${moduleName} import ${className}`);
      allExports.push(className);
    }

    domainClasses.push(
      `class ${domainClass}:\n    def __init__(self, transport: TransportAdapter) -> None:\n        self._transport = transport\n\n${eventProperties}`
    );
    domainProperties.push(
      `    @property\n    def ${domain}(self) -> ${domainClass}:\n        return ${domainClass}(self._transport)`
    );
  }

  const initContent = `from __future__ import annotations
from eventgen_runtime import TransportAdapter
${[...new Set(allImports)].join("\n")}

__all__ = ["create_client", ${allExports.map((e) => `"${e}"`).join(", ")}]


${domainClasses.join("\n\n")}


class _EventClient:
    def __init__(self, transport: TransportAdapter) -> None:
        self._transport = transport

${domainProperties.join("\n\n")}


def create_client(transport: TransportAdapter) -> _EventClient:
    return _EventClient(transport)
`;

  fs.writeFileSync(path.join(pkgDir, "__init__.py"), initContent);
  fs.writeFileSync(path.join(eventsDir, "__init__.py"), "");
}
