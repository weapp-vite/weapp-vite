import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import process from 'node:process'

export interface MemoryAvailability {
  availableMemoryBytes: number
  availableMemorySource: 'os-freemem' | 'darwin-memory-pressure'
}

type MemoryPressureRunner = (executable: string, args: string[], options: ExecFileSyncOptionsWithStringEncoding) => string

/** macOS 压力百分比包含可回收容量，只采用其一半估值，并保留原有空闲内存作为下限。 */
export function readMemoryAvailability(options: {
  totalMemoryBytes: number
  freeMemoryBytes: number
  platform?: NodeJS.Platform
  run?: MemoryPressureRunner
}): MemoryAvailability {
  const { totalMemoryBytes, freeMemoryBytes, platform = process.platform } = options
  const fallback: MemoryAvailability = {
    availableMemoryBytes: Math.max(0, Math.min(totalMemoryBytes, freeMemoryBytes)),
    availableMemorySource: 'os-freemem',
  }
  if (platform !== 'darwin') {
    return fallback
  }
  try {
    const run = options.run ?? ((executable, args, settings) => execFileSync(executable, args, settings))
    const output = run('/usr/bin/memory_pressure', ['-Q'], {
      encoding: 'utf8',
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
      timeout: 1_000,
      maxBuffer: 8_192,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const matches = [...output.matchAll(/^System-wide memory free percentage:[ \t]*(\d+(?:\.\d+)?)%[ \t]*\r?$/gm)]
    const percentage = matches.length === 1 ? Number(matches[0]![1]) : Number.NaN
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return fallback
    }
    const availableMemoryBytes = Math.min(totalMemoryBytes, Math.floor(totalMemoryBytes * (percentage / 100) * 0.5))
    return availableMemoryBytes > fallback.availableMemoryBytes
      ? { availableMemoryBytes, availableMemorySource: 'darwin-memory-pressure' }
      : fallback
  }
  catch {
    return fallback
  }
}
