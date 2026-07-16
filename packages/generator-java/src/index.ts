import fs from "node:fs";
import path from "node:path";
import { toCamelCase, toPascalCase, type BindingFile, type EventDefinition } from "@eventgen/core";

function toLowerCamelCase(input: string): string {
  const s = toCamelCase(input);
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function generateJavaSdk(input: { events: EventDefinition[]; bindings: BindingFile; outDir: string; javaPackage: string }) {
  const base = path.join(input.outDir, "src", "main", "java", ...input.javaPackage.split("."));
  fs.mkdirSync(base, { recursive: true });

  fs.writeFileSync(
    path.join(input.outDir, "pom.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.company</groupId>
  <artifactId>generated-events-sdk</artifactId>
  <version>0.1.0</version>
  <dependencies>
    <dependency>
      <groupId>com.eventgen</groupId>
      <artifactId>runtime-java</artifactId>
      <version>0.1.0</version>
    </dependency>
  </dependencies>
</project>
`
  );

  // Group events by domain for the client factory
  const domainMap = new Map<string, Array<{ event: EventDefinition; className: string; publisherName: string; handlerName: string; consumerName: string; methodName: string }>>();

  for (const event of input.events) {
    const eventName = event.id.split(".").slice(1).join(".");
    const className = `${toPascalCase(event.domain)}${toPascalCase(eventName)}Payload`;
    const publisherName = `${toPascalCase(event.domain)}${toPascalCase(eventName)}Publisher`;
    const handlerName = `${toPascalCase(event.domain)}${toPascalCase(eventName)}Handler`;
    const consumerName = `${toPascalCase(event.domain)}${toPascalCase(eventName)}Consumer`;
    const methodName = toLowerCamelCase(event.name);
    const props = Object.entries((event.payloadSchema.properties ?? {}) as Record<string, { type?: string }>);
    const consumers = (event.consumers ?? []).map((consumer) => `"${consumer}"`).join(", ");

    // Generate Payload class with builder
    const javaType = (t?: string) => mapJava(t);
    const fields = props.map(([k, v]) => `    private ${javaType(v.type)} ${k};`).join("\n");
    const getters = props.map(([k, v]) => `    public ${javaType(v.type)} get${toPascalCase(k)}() { return ${k}; }`).join("\n");
    const builderSetters = props.map(([k, v]) => `        public Builder ${k}(${javaType(v.type)} ${k}) { o.${k} = ${k}; return this; }`).join("\n");

    fs.writeFileSync(
      path.join(base, `${className}.java`),
      `package ${input.javaPackage};

public class ${className} {
${fields}

    private ${className}() {}

${getters}

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final ${className} o = new ${className}();
${builderSetters}
        public ${className} build() { return o; }
    }
}
`
    );

    // Generate Publisher class
    fs.writeFileSync(
      path.join(base, `${publisherName}.java`),
      `package ${input.javaPackage};

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.EventMetadata;
import com.eventgen.runtime.FifoOptions;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;
import java.time.Instant;
import java.util.UUID;

public class ${publisherName} {
    private final TransportAdapter transport;
    public ${publisherName}(TransportAdapter transport) { this.transport = transport; }
    public PublishResult publish(${className} payload) {
        return publish(payload, UUID.randomUUID().toString(), null);
    }
    public PublishResult publish(${className} payload, String traceId) {
        return publish(payload, traceId, null);
    }
    public PublishResult publish(${className} payload, String traceId, FifoOptions fifo) {
        EventMetadata metadata = new EventMetadata(Instant.now().toString(), traceId, fifo);
        return transport.publish(new EventEnvelope("${event.id}", "${event.version}", payload, metadata));
    }
}
`
    );

    // Generate Handler interface
    fs.writeFileSync(
      path.join(base, `${handlerName}.java`),
      `package ${input.javaPackage};

import com.eventgen.runtime.EventEnvelope;

@FunctionalInterface
public interface ${handlerName} {
    void handle(${className} payload, EventEnvelope envelope) throws Exception;
}
`
    );

    // Generate Consumer class
    fs.writeFileSync(
      path.join(base, `${consumerName}.java`),
      `package ${input.javaPackage};

import com.eventgen.runtime.EventEnvelope;
import java.util.List;

public class ${consumerName} {
    private final ${handlerName} handler;

    public ${consumerName}(${handlerName} handler) {
        this.handler = handler;
    }

    public String eventId() { return "${event.id}"; }
    public String version() { return "${event.version}"; }
    public List<String> consumers() { return List.of(${consumers}); }

    public void handle(EventEnvelope envelope) throws Exception {
        if (!eventId().equals(envelope.eventId()) || !version().equals(envelope.version())) {
            throw new IllegalArgumentException("Unexpected event envelope: " + envelope.eventId() + "@" + envelope.version());
        }
        handler.handle((${className}) envelope.payload(), envelope);
    }
}
`
    );

    if (!domainMap.has(event.domain)) domainMap.set(event.domain, []);
    domainMap.get(event.domain)!.push({ event, className, publisherName, handlerName, consumerName, methodName });
  }

  // Generate EventClient with nested domain accessors
  const domainMethods = Array.from(domainMap.entries()).map(([domain, entries]) => {
    const domainClass = `${toPascalCase(domain)}Events`;
    const eventMethods = entries
      .map(({ publisherName, methodName }) =>
        `        public ${publisherName} ${methodName}() { return new ${publisherName}(transport); }`
      )
      .join("\n");
    return `    public ${domainClass} ${domain}() { return new ${domainClass}(transport); }\n\n    public static class ${domainClass} {\n        private final TransportAdapter transport;\n        ${domainClass}(TransportAdapter transport) { this.transport = transport; }\n${eventMethods}\n    }`;
  }).join("\n\n");

  fs.writeFileSync(
    path.join(base, "EventClient.java"),
    `package ${input.javaPackage};

import com.eventgen.runtime.TransportAdapter;

public class EventClient {
    private final TransportAdapter transport;

    public EventClient(TransportAdapter transport) {
        this.transport = transport;
    }

${domainMethods}
}
`
  );

  const consumerDomainBuilders = Array.from(domainMap.entries()).map(([domain, entries]) => {
    const builderClass = `${toPascalCase(domain)}ConsumerBuilder`;
    const handlerMethods = entries
      .map(({ event, consumerName, handlerName, methodName }) =>
        `        public ${builderClass} ${methodName}(${handlerName} handler) {\n            parent.routes.put("${event.id}@${event.version}", new ${consumerName}(handler)::handle);\n            return this;\n        }`
      )
      .join("\n\n");
    return `    public ${builderClass} ${domain}() { return new ${builderClass}(this); }\n\n    public static class ${builderClass} {\n        private final Builder parent;\n\n        ${builderClass}(Builder parent) { this.parent = parent; }\n\n${handlerMethods}\n\n        public Builder done() { return parent; }\n        public EventConsumer build() { return parent.build(); }\n    }`;
  }).join("\n\n");

  fs.writeFileSync(
    path.join(base, "EventConsumer.java"),
    `package ${input.javaPackage};

import com.eventgen.runtime.EventEnvelope;
import java.util.HashMap;
import java.util.Map;

public class EventConsumer {
    private final Map<String, EnvelopeHandler> routes;

    private EventConsumer(Map<String, EnvelopeHandler> routes) {
        this.routes = routes;
    }

    public boolean handle(EventEnvelope envelope) throws Exception {
        EnvelopeHandler handler = routes.get(envelope.eventId() + "@" + envelope.version());
        if (handler == null) return false;
        handler.handle(envelope);
        return true;
    }

    public static Builder builder() { return new Builder(); }

    @FunctionalInterface
    private interface EnvelopeHandler {
        void handle(EventEnvelope envelope) throws Exception;
    }

    public static class Builder {
        private final Map<String, EnvelopeHandler> routes = new HashMap<>();

${consumerDomainBuilders}

        public EventConsumer build() {
            return new EventConsumer(new HashMap<>(routes));
        }
    }
}
`
  );
}

function mapJava(t?: string): string {
  return t === "number" ? "java.math.BigDecimal"
    : t === "integer" ? "Long"
    : t === "boolean" ? "Boolean"
    : "String";
}
