import { performance } from 'perf_hooks'
import { pino } from 'pino'
import * as util from 'util'

import { context, trace } from '@opentelemetry/api'

import { fromString,toNumberString } from './dd-fns'
import { LoggerContext, LogLevel } from './types'

export const rootLogger: pino.Logger<pino.LoggerOptions> = pino({
  enabled: !process.env.DISABLE_LOGGER,
  level:  (process.env.LOG_LEVEL || LogLevel.Info).toLowerCase(),
  formatters: {
    level: (label) => {
      return { level: label }
    },
    log: (input) => {
      const span = trace.getSpan(context.active())
      if (span) {
        const context = span.spanContext()
        const traceIdEnd = context.traceId.slice(context.traceId.length / 2)
        input = {
          ...input,
          trace_id: context.traceId,
          trace_flags: context.traceFlags,
          span_id: context.spanId,
          dd: {
            trace_id: toNumberString(fromString(traceIdEnd, 16)),
            span_id: toNumberString(fromString(context.spanId, 16)),
          },
        }
      }
      return input
    },
  },
})

class AppLogger {

  private logger

  constructor(
    name?: string,
    context: LoggerContext = LoggerContext.General) {
    this.logger = rootLogger.child({ name, context })
  }

  private tap<T>(fn: (val: T) => T) {
    return (value: T): T => {
      fn(value)
      return value
    }
  }

  public log(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this
    instance.logger.info(...args)
  }

  public info(...args: any[]): any {
    const instance = typeof this === 'undefined' ? new AppLogger() : this
    instance.logger.info(...args)
  }

  public debug(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this
    instance.logger.debug(...args)
  }

  public warn(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this
    instance.logger.warn(...args)
  }

  public error(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this
    instance.logger.error(...args)
  }

  public fatal(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this
    instance.logger.error(...args)
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public traceFn(msg: string, fn: Function) {
    return (...args: any[]): Promise<any> => {
      this.debug(`[traceFn:entry] ${msg}`)
      const start = performance.now()
      return Promise.resolve(fn(...args))
        .then(this.tap(() => this.debug(`[traceFn:exit] ${msg}`)))
        .then(this.tap(() => this.debug(`[Timing] ${msg}: ${performance.now() - start}ms`)))
    }
  }

  public inspect(obj: object): string {
    return util.inspect(obj, {
      showHidden: false,
      depth: null,
      compact: true,
      breakLength: Infinity,
    })
  }

}

export const LoggerFactory = (name: string, context?: LoggerContext): AppLogger =>
  new AppLogger(name, context)
