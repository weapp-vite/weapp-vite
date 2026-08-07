import type { StatefulHmrOutputFile } from './outputWriter'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { statefulHmrRolldownRuntimeSource } from './runtimeSource'

const require = createRequire(import.meta.url)
const ROLLDOWN_RUNTIME_IMPORT_RE = /^import\s+\{[^\n]+\}\s+from\s+['"]\.\/experimental-runtime-base\.mjs['"];?\s*/
const ROLLDOWN_EXPORT_RE = /^export\s+/gm

export const STATEFUL_HMR_RUNTIME_COMPATIBILITY_ERROR_CODE = 'WEAPP_VITE_STATEFUL_HMR_RUNTIME_INCOMPATIBLE'

export class StatefulHmrRuntimeCompatibilityError extends Error {
  readonly code = STATEFUL_HMR_RUNTIME_COMPATIBILITY_ERROR_CODE

  constructor(message: string) {
    super(message)
    this.name = 'StatefulHmrRuntimeCompatibilityError'
  }
}

function readRolldownRuntimeSource(subpath: string): string {
  try {
    return readFileSync(require.resolve(subpath), 'utf8')
  }
  catch (error) {
    throw new StatefulHmrRuntimeCompatibilityError(
      `无法读取 Rolldown 状态保持 HMR 基础运行时 ${subpath}：${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function createStatefulHmrRolldownRuntimeSource(): string {
  const baseSource = readRolldownRuntimeSource('rolldown/experimental/runtime')
    .replace(ROLLDOWN_RUNTIME_IMPORT_RE, '')
    .replace(ROLLDOWN_EXPORT_RE, '')
  const helperSource = readRolldownRuntimeSource('rolldown/experimental/runtime')
    .match(ROLLDOWN_RUNTIME_IMPORT_RE)?.[0]

  if (!helperSource || !baseSource.includes('class DevRuntime')) {
    throw new StatefulHmrRuntimeCompatibilityError('当前 Rolldown 包未提供可组合的 DevRuntime 基础运行时。')
  }

  const runtimeBaseSource = readRolldownRuntimeSource('rolldown/package.json')
  const packageRoot = require.resolve('rolldown/package.json').replace(/package\.json$/, '')
  const helpers = readFileSync(`${packageRoot}dist/experimental-runtime-base.mjs`, 'utf8')
    .replace(ROLLDOWN_EXPORT_RE, '')

  if (!runtimeBaseSource.includes('"name": "rolldown"') || !helpers.includes('var __exportAll')) {
    throw new StatefulHmrRuntimeCompatibilityError('当前 Rolldown 包的 dev runtime helper 结构与 weapp-vite 不兼容。')
  }

  return `${helpers}\n${baseSource}\n${statefulHmrRolldownRuntimeSource}`
}

export function assertStatefulHmrRuntimeOutput(output: StatefulHmrOutputFile[]): void {
  const runtime = output.find(item => item.type === 'chunk' && item.fileName === 'rolldown-runtime.js')
  if (!runtime || runtime.type !== 'chunk') {
    throw new StatefulHmrRuntimeCompatibilityError('stateful HMR 初始构建未生成 rolldown-runtime.js。')
  }
  const requiredContracts = [
    /(?:class|var) DevRuntime(?:\s*=\s*class)?/,
    /(?:class|var) WeappViteDevRuntime(?:\s*=\s*class)?/,
    'new WeappViteDevRuntime',
    '__WEAPP_VITE_STATEFUL_HMR_BRIDGE__',
  ]
  const missing = requiredContracts.filter(contract => (
    typeof contract === 'string' ? !runtime.code.includes(contract) : !contract.test(runtime.code)
  ))
  if (missing.length > 0) {
    throw new StatefulHmrRuntimeCompatibilityError(
      `stateful HMR runtime 不完整，缺少 ${missing.length} 项必要契约。`,
    )
  }
}

export function isStatefulHmrRuntimeCompatibilityError(error: unknown): boolean {
  return error instanceof StatefulHmrRuntimeCompatibilityError
    || (typeof error === 'object'
      && error !== null
      && Reflect.get(error, 'code') === STATEFUL_HMR_RUNTIME_COMPATIBILITY_ERROR_CODE)
}
