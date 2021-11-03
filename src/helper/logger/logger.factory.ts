import { AppLogger } from './logger'
import { LoggerContext } from './logger.context'

export function LoggerFactory(name: string, context?: LoggerContext): AppLogger {
  return new AppLogger(name, context)
}
