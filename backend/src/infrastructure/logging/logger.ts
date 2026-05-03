export type LoggerOptions = {
  /**
   * When true, each line includes ISO time and `[INFO]` / `[WARN]` / `[ERROR]`
   * (matches long-running CLI scripts under `scripts/`).
   */
  timestamps?: boolean
}

/**
 * Small scope-prefixed logger (no extra deps). Use `createLogger('http')` etc.
 */
export class Logger {
  constructor(
    private readonly scope: string,
    private readonly opts: LoggerOptions = {},
  ) {}

  private line(kind: 'info' | 'warn' | 'error', message: string): string {
    if (!this.opts.timestamps) {
      return `[${this.scope}] ${message}`
    }
    const lvl = kind === 'info' ? 'INFO' : kind === 'warn' ? 'WARN' : 'ERROR'
    return `[${this.scope}] ${new Date().toISOString()} [${lvl}] ${message}`
  }

  info(message: string, ...rest: unknown[]): void {
    const head = this.line('info', message)
    if (rest.length === 0) console.log(head)
    else console.log(head, ...rest)
  }

  warn(message: string, ...rest: unknown[]): void {
    const head = this.line('warn', message)
    if (rest.length === 0) console.warn(head)
    else console.warn(head, ...rest)
  }

  error(message: string, ...rest: unknown[]): void {
    const head = this.line('error', message)
    if (rest.length === 0) console.error(head)
    else console.error(head, ...rest)
  }
}

export function createLogger(scope: string, opts?: LoggerOptions): Logger {
  return new Logger(scope, opts)
}
