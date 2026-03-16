import process from 'node:process'
import semverGte from 'semver/functions/gte.js'
import semverSatisfies from 'semver/functions/satisfies.js'
import semverValid from 'semver/functions/valid.js'
import logger from '../logger'

const LEADING_V = /^v/

type Runtime = 'node' | 'deno' | 'bun'

interface MinVersions {
  node?: string
  deno?: string
  bun?: string
}

interface RuntimeInfo {
  runtime: Runtime
  version: string
}

interface RuntimeLogger {
  warn: (message: string) => void
}

interface CheckRuntimeOptions {
  runtimeInfo?: RuntimeInfo
  logger?: RuntimeLogger
}

declare const Deno: {
  version: {
    deno: string
    v8: string
    typescript: string
  }
}

function getRuntime(): RuntimeInfo {
  // 运行时：Deno
  if (typeof (globalThis as any).Deno !== 'undefined' && 'version' in Deno) {
    return {
      runtime: 'deno',
      version: Deno.version.deno,
    }
  }

  // 运行时：Bun
  if (typeof (globalThis as any).Bun !== 'undefined') {
    return {
      runtime: 'bun',
      version: (globalThis as any).Bun.version,
    }
  }

  // 运行时：Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return {
      runtime: 'node',
      version: process.version.replace(LEADING_V, ''), // "v18.17.1" -> "18.17.1"
    }
  }

  throw new Error('无法识别运行时：无法确定 Node.js / Deno / Bun。')
}

export function checkRuntime(minVersions: MinVersions, options: CheckRuntimeOptions = {}): void {
  const { runtime, version } = options.runtimeInfo ?? getRuntime()
  const runtimeLogger = options.logger ?? logger
  const required = minVersions[runtime]

  if (!required) {
    runtimeLogger.warn(`未为 ${runtime} 指定最低版本，已跳过检查。`)
    return
  }

  const isPlainVersion = Boolean(semverValid(required))
  const isSatisfied = isPlainVersion
    ? semverGte(version, required)
    : semverSatisfies(version, required)

  if (!isSatisfied) {
    const expected = isPlainVersion ? `>= ${required}` : required
    runtimeLogger.warn(`当前 ${runtime} 版本为 ${version} 无法满足 \`weapp-vite\` 最低要求的版本(${expected})`)
  }
}
