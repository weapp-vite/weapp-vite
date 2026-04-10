import type { GlobalCLIOptions } from '../../types'
import process from 'node:process'

export function resolveWebHost(host: GlobalCLIOptions['host']) {
  if (host === undefined) {
    return undefined
  }
  if (typeof host === 'boolean') {
    return host
  }
  if (typeof host === 'string') {
    return host
  }
  return String(host)
}

export function waitForServeShutdownSignal() {
  return new Promise<void>((resolve) => {
    const onSignal = () => {
      process.off('SIGINT', onSignal)
      process.off('SIGTERM', onSignal)
      resolve()
    }

    process.on('SIGINT', onSignal)
    process.on('SIGTERM', onSignal)
  })
}
