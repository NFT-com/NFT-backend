import { Sampler, SpanKind } from '@opentelemetry/api'

import opentelemetry = require('@opentelemetry/api');

import { Attributes } from '@opentelemetry/api/build/src/common/attributes'
import { AlwaysOnSampler } from '@opentelemetry/core'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SemanticAttributes, SemanticResourceAttributes as ResourceAttributesSC } from '@opentelemetry/semantic-conventions'

const Exporter = OTLPTraceExporter
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'

type FilterFunction = (spanName: string, spanKind: SpanKind, attributes: Attributes) => boolean;

function filterSampler(filterFn: FilterFunction, parent: Sampler): Sampler {
  return {
    shouldSample(ctx, tid, spanName, spanKind, attr, links) {
      if (filterFn(spanName, spanKind, attr)) {
        return { decision: opentelemetry.SamplingDecision.NOT_RECORD }
      }
      return parent.shouldSample(ctx, tid, spanName, spanKind, attr, links)
    },
    toString() {
      return `FilterSampler(${parent.toString()})`
    },
  }
}

function ignoreHealthCheck(_spanName: string, spanKind: SpanKind, attributes: Attributes): boolean {
  return spanKind === opentelemetry.SpanKind.SERVER || attributes[SemanticAttributes.HTTP_TARGET] === '/.well-known/apollo/server-health'
}

export const setupTracing = (serviceName: string): opentelemetry.Tracer => {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [ResourceAttributesSC.SERVICE_NAME]: serviceName,
    }),
    sampler: filterSampler(ignoreHealthCheck, new AlwaysOnSampler()),
  })
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      // Express instrumentation expects HTTP layer to be instrumented
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new GraphQLInstrumentation(),
      new IORedisInstrumentation(),
      new PgInstrumentation(),
    ],
  })

  const exporter = new Exporter({
    url: '',
  })

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))

  // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
  provider.register()

  return opentelemetry.trace.getTracer(serviceName)
}