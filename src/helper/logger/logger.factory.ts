import { AppLogger } from './logger'
import { LoggerContext } from './logger.context'

export function LoggerFactory(name: string, context?: keyof typeof LoggerContext): AppLogger {
  return new AppLogger(name, LoggerContext[context])
}
