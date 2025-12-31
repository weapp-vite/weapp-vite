import process from 'node:process'
import semverGte from 'semver/functions/gte'
import logger from '../logger'

type Runtime = 'node' | 'deno' | 'bun'

interface MinVersions {
  node?: string
  deno?: string
  bun?: string
}

declare const Deno: {
  version: {
    deno: string
    v8: string
    typescript: string
  }
}

function getRuntime(): { runtime: Runtime, version: string } {
  // 运行时：Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return {
      runtime: 'node',
      version: process.version.replace(/^v/, ''), // "v18.17.1" -> "18.17.1"
    }
  }

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

  throw new Error('Unknown runtime: cannot determine Node.js / Deno / Bun')
}

export function checkRuntime(minVersions: MinVersions): void {
  const { runtime, version } = getRuntime()
  const required = minVersions[runtime]

  if (!required) {
    logger.warn(`No minimum version specified for ${runtime}, skipping check.`)
    return
  }

  if (!semverGte(version, required)) {
    logger.warn(`当前 ${runtime} 版本为 ${version} 无法满足 \`weapp-vite\` 最低要求的版本(>= ${required})`)
  }
}
