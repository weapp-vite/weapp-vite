import type { WeappMcpConfig } from '../types'
import type { GlobalCLIOptions } from './types'

export function applyMcpCliOptions(
  config: boolean | WeappMcpConfig | undefined,
  options: Pick<GlobalCLIOptions, 'mcp'>,
): boolean | WeappMcpConfig | undefined {
  if (options.mcp === false) {
    return false
  }
  if (options.mcp === true) {
    const record = typeof config === 'object' && config ? config : {}
    return {
      ...record,
      enabled: true,
      autoStart: true,
    }
  }
  return config
}
