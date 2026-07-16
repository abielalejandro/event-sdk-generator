#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { buildCatalog, loadEventDefinitions, readJson, validateDefinitions, validateBindings, type BindingFile } from "@eventgen/core";
import { generateTypeScriptSdk } from "@eventgen/generator-typescript";
import { generateJavaSdk } from "@eventgen/generator-java";
import { generatePythonSdk } from "@eventgen/generator-python";
import { generateGoSdk } from "@eventgen/generator-go";

type Config = {
  events?: string;
  bindings?: string;
  catalog?: string;
  generate?: {
    typescript?: { out?: string };
    java?: { out?: string; package?: string };
    python?: { out?: string; packageName?: string };
    go?: { out?: string; modulePath?: string };
  };
};

type GenerateTarget = "typescript" | "java" | "python" | "go";

const GENERATE_TARGETS: GenerateTarget[] = ["typescript", "java", "python", "go"];

const DEFAULTS: Required<Omit<Config, "generate">> & { generate: Required<Config["generate"] & object> } = {
  events: "./events/definitions",
  bindings: "./events/bindings/dev.json",
  catalog: "./apps/web-catalog/public/catalog.json",
  generate: {
    typescript: { out: "./generated/typescript" },
    java: { out: "./generated/java", package: "com.company.events" },
    python: { out: "./generated/python", packageName: "company_events" },
    go: { out: "./generated/go", modulePath: "github.com/company/generated-events-sdk" },
  },
};

function loadConfig(): Config {
  const configPath = path.resolve(process.cwd(), "eventgen.config.json");
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as Config;
  }
  return {};
}

function resolve(flag: string | undefined, configValue: string | undefined, defaultValue: string): string {
  return flag ?? configValue ?? defaultValue;
}

function resolveGenerateTargets(target: string | undefined): GenerateTarget[] {
  if (!target || target === "all") return GENERATE_TARGETS;
  if (GENERATE_TARGETS.includes(target as GenerateTarget)) return [target as GenerateTarget];
  throw new Error(`Unsupported target: ${target}`);
}

const program = new Command();
program.name("event-sdk").description("Event SDK Generator CLI").version("0.1.0");

program.command("validate")
  .option("--events <dir>", "Directory with event definitions")
  .option("--bindings <file>", "Binding file path")
  .action((opts) => {
    const cfg = loadConfig();
    const eventsDir = resolve(opts.events, cfg.events, DEFAULTS.events);
    const bindingsFile = resolve(opts.bindings, cfg.bindings, DEFAULTS.bindings);
    const events = loadEventDefinitions(eventsDir);
    const bindings = readJson<BindingFile>(bindingsFile);
    const errors = [
      ...validateDefinitions(events),
      ...validateBindings(bindings, events),
    ];
    if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
    console.log(`OK: ${events.length} event definition(s) and ${bindings.bindings.length} binding(s) valid.`);
  });

program.command("build-catalog")
  .option("--events <dir>", "Directory with event definitions")
  .option("--bindings <file>", "Binding file path")
  .option("--out <file>", "Output catalog.json path")
  .action((opts) => {
    const cfg = loadConfig();
    const eventsDir = resolve(opts.events, cfg.events, DEFAULTS.events);
    const bindingsFile = resolve(opts.bindings, cfg.bindings, DEFAULTS.bindings);
    const outFile = resolve(opts.out, cfg.catalog, DEFAULTS.catalog);
    const catalog = buildCatalog(loadEventDefinitions(eventsDir), readJson<BindingFile>(bindingsFile));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(catalog, null, 2));
    console.log(`Catalog written to ${outFile}`);
  });

program.command("generate")
  .option("--target <target>", "typescript | java | python | go | all", "all")
  .option("--events <dir>", "Directory with event definitions")
  .option("--bindings <file>", "Binding file path")
  .option("--out <dir>", "Output directory for generated SDK")
  .option("--java-package <pkg>", "Java package name")
  .option("--python-package <pkg>", "Python package name")
  .option("--go-module <path>", "Go module path")
  .action((opts) => {
    const cfg = loadConfig();
    const eventsDir = resolve(opts.events, cfg.events, DEFAULTS.events);
    const bindingsFile = resolve(opts.bindings, cfg.bindings, DEFAULTS.bindings);
    const events = loadEventDefinitions(eventsDir);
    const bindings = readJson<BindingFile>(bindingsFile);

    const targets = resolveGenerateTargets(opts.target);

    for (const target of targets) {
      if (target === "typescript") {
        const outDir = resolve(opts.out, cfg.generate?.typescript?.out, DEFAULTS.generate.typescript.out!);
        generateTypeScriptSdk({ events, bindings, outDir });
      } else if (target === "java") {
        const outDir = resolve(opts.out, cfg.generate?.java?.out, DEFAULTS.generate.java.out!);
        const javaPackage = resolve(opts.javaPackage, cfg.generate?.java?.package, DEFAULTS.generate.java.package!);
        generateJavaSdk({ events, bindings, outDir, javaPackage });
      } else if (target === "python") {
        const outDir = resolve(opts.out, cfg.generate?.python?.out, DEFAULTS.generate.python.out!);
        const packageName = opts.pythonPackage ?? cfg.generate?.python?.packageName ?? DEFAULTS.generate.python.packageName;
        generatePythonSdk({ events, bindings, outDir, packageName });
      } else if (target === "go") {
        const outDir = resolve(opts.out, cfg.generate?.go?.out, DEFAULTS.generate.go.out!);
        const modulePath = opts.goModule ?? cfg.generate?.go?.modulePath ?? DEFAULTS.generate.go.modulePath;
        generateGoSdk({ events, bindings, outDir, modulePath });
      }
    }
    console.log(`${targets.join(", ")} SDK${targets.length === 1 ? "" : "s"} generated.`);
  });

program.parse();
