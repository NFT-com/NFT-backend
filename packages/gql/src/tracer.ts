import { Sampler, SpanKind } from '@opentelemetry/api'

import opentelemetry = require('@opentelemetry/api');

import { Attributes } from '@opentelemetry/api/build/src/common/attributes'
import { AlwaysOnSampler } from '@opentelemetry/core'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import { Resource } from '@opentelemetry/resources'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SemanticAttributes, SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

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

function ignoreSpan(_spanName: string, spanKind: SpanKind, attributes: Attributes): boolean {
  return spanKind === opentelemetry.SpanKind.INTERNAL
    || attributes[SemanticAttributes.HTTP_METHOD] === 'OPTIONS'
    || attributes[SemanticAttributes.HTTP_TARGET] === '/.well-known/apollo/server-health'
    || (attributes[SemanticAttributes.HTTP_URL]
        && attributes[SemanticAttributes.HTTP_URL].toString().includes('sentry.io'))
}

export const setupTracing = (serviceName: string): opentelemetry.Tracer => {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    sampler: filterSampler(ignoreSpan, new AlwaysOnSampler()),
  })
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      // Express instrumentation expects HTTP layer to be instrumented
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new GraphQLInstrumentation({ depth: 1 }),
      new IORedisInstrumentation(),
      new PgInstrumentation(),
    ],
  })

  const exporter = new OTLPTraceExporter()

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))

  // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
  provider.register()

  return opentelemetry.trace.getTracer(serviceName)
}