import { blue, Chalk, green, red, redBright, white, yellow } from 'chalk'
import * as util from 'util'

import { LoggerContext, LogLevel } from './types'

class AppLogger {

  constructor(
    private readonly name?: string,
    private readonly context: LoggerContext = LoggerContext.General) {
  }

  private dateString(): string {
    return `${(new Date()).toISOString()}`
  }

  private getLogColorFn(level: LogLevel): Chalk {
    switch (level) {
    case LogLevel.Trace: return blue.bind(this)
    case LogLevel.Debug: return blue.bind(this)
    case LogLevel.Info: return green.bind(this)
    case LogLevel.Warn: return yellow.bind(this)
    case LogLevel.Error: return red.bind(this)
    case LogLevel.Fatal: return redBright.bind(this)
    default: return white.bind(this)
    }
  }

  private argumentsToList(level: LogLevel, ...args: any[]): any[] {
    const colorFn = this.getLogColorFn(level)
    if (process.env.NODE_ENV !== 'local') {
      args = args.map((arg) => {
        if (typeof arg === 'object') {
          arg = JSON.stringify(arg)
        }
        return arg.replaceAll(/(\r\n|\n|\r)/g, '\u2028')
      })
    }
    return [
      `${this.dateString()} ${colorFn(`[${level}]`)}${colorFn(`[${this.context}]`)}${this.name ? colorFn(`[${this.name}]`) : ''}`,
      ...args,
    ]
  }

  private tap<T>(fn: (val: T) => T) {
    return (value: T): T => {
      fn(value)
      return value
    }
  }

  public systemLogLevel(): string {
    return (process.env.LOG_LEVEL || LogLevel.Info).toUpperCase()
  }

  public enabledContexts(): string[] {
    return (process.env.LOG_CONTEXT || '')
      .split(',')
      .filter(a => a !== '') || [LoggerContext.General]
  }

  public isEnabled(): boolean {
    const contexts = this.enabledContexts()

    return contexts.length === 0
      ? true
      : contexts.some(a => a === this.context)
  }

  public isDisabled(): boolean {
    return !this.isEnabled()
  }

  public canLogThisLevel(level: LogLevel): boolean {
    if (this.isDisabled()) return false

    const systemLevel = this.systemLogLevel()

    switch (level) {
    case LogLevel.Trace: return systemLevel === LogLevel.Trace
    case LogLevel.Debug: return systemLevel === LogLevel.Trace
        || systemLevel === LogLevel.Debug
    case LogLevel.Info: return systemLevel === LogLevel.Trace
        || systemLevel === LogLevel.Debug
        || systemLevel === LogLevel.Info
    case LogLevel.Warn: return systemLevel === LogLevel.Trace
        || systemLevel === LogLevel.Debug
        || systemLevel === LogLevel.Info
        || systemLevel === LogLevel.Warn
    case LogLevel.Error: return systemLevel !== LogLevel.Fatal
    case LogLevel.Fatal: return true
    default: return false
    }
  }

  public cannotLogThisLevel(level: LogLevel): boolean {
    return !this.canLogThisLevel(level)
  }

  public log(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this

    if (instance.cannotLogThisLevel(LogLevel.Info)) return

    console.info.apply(instance, instance.argumentsToList(LogLevel.Info, ...args))
  }

  public info(...args: any[]): any {
    const instance = typeof this === 'undefined' ? new AppLogger() : this

    if (instance.cannotLogThisLevel(LogLevel.Info)) return

    console.info.apply(instance, instance.argumentsToList(LogLevel.Info, ...args))
  }

  public debug(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this

    if (instance.cannotLogThisLevel(LogLevel.Debug)) return

    console.debug.apply(instance, instance.argumentsToList(LogLevel.Debug, ...args))
  }

  public warn(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this

    if (instance.cannotLogThisLevel(LogLevel.Warn)) return

    console.warn.apply(instance, instance.argumentsToList(LogLevel.Warn, ...args))
  }

  public error(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this

    if (this.cannotLogThisLevel(LogLevel.Error)) return

    console.error.apply(instance, instance.argumentsToList(LogLevel.Error, ...args))
  }

  public fatal(...args: any[]): void {
    const instance = typeof this === 'undefined' ? new AppLogger() : this

    if (instance.cannotLogThisLevel(LogLevel.Fatal)) return

    console.error.apply(instance, instance.argumentsToList(LogLevel.Fatal, ...args))
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public traceFn(msg: string, fn: Function) {
    return (...args: any[]): Promise<any> => {
      const canLog = this.canLogThisLevel(LogLevel.Debug)
      const ts = this.dateString()
      this.debug(`[traceFn:entry] ${msg}`)
      if (canLog) console.time(`${ts} [Timing] ${msg}`)
      return Promise.resolve(fn(...args))
        .then(this.tap(() => this.debug(`[traceFn:exit] ${msg}`)))
        .then(this.tap(() => canLog && console.timeEnd(`${ts} [Timing] ${msg}`)))
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public traceFn2(msgFn: Function, fn: Function) {
    return (...args: any[]): Promise<any> => {
      const canLog = this.canLogThisLevel(LogLevel.Debug)
      const msg = msgFn(...args)
      const ts = this.dateString()
      this.debug(`[traceFn:entry] ${msg}`)
      if (canLog) console.time(`${ts} ${yellow('[Timing]')} ${msg}`)
      return Promise.resolve(fn(...args))
        .then(this.tap(() => this.debug(`[traceFn:exit] ${msg}`)))
        .then(this.tap(() => canLog && console.timeEnd(`${ts} ${yellow('[Timing]')} ${msg}`)))
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
