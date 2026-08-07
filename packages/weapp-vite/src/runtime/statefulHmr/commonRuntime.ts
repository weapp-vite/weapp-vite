import type { StatefulHmrOutputFile } from './outputWriter'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { statefulHmrRolldownRuntimeSource } from './runtimeSource'

const require = createRequire(import.meta.url)
const STATIC_IMPORT_RE = /^import\s+(?:\{[^}\n]*\}|[A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"](?:;\s*)?$/gm
const EXPORT_PREFIX_RE = /^export\s+/gm

export const STATEFUL_HMR_RUNTIME_COMPATIBILITY_ERROR_CODE = 'WEAPP_VITE_STATEFUL_HMR_RUNTIME_INCOMPATIBLE'

export class StatefulHmrRuntimeCompatibilityError extends Error {
  readonly code = STATEFUL_HMR_RUNTIME_COMPATIBILITY_ERROR_CODE

  constructor(message: string) {
    super(message)
    this.name = 'StatefulHmrRuntimeCompatibilityError'
  }
}

function readRolldownRuntimeSource(subpath: string): { filePath: string, source: string } {
  try {
    const filePath = require.resolve(subpath)
    return { filePath, source: readFileSync(filePath, 'utf8') }
  }
  catch (error) {
    throw new StatefulHmrRuntimeCompatibilityError(
      `无法读取 Rolldown 状态保持 HMR 基础运行时 ${subpath}：${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function stripModuleSyntax(source: string): string {
  return source.replace(STATIC_IMPORT_RE, '').replace(EXPORT_PREFIX_RE, '')
}

function resolveRuntimeHelpers(runtime: { filePath: string, source: string }): string {
  const helperSpecifiers = [...runtime.source.matchAll(STATIC_IMPORT_RE)]
    .map(match => match[1])
    .filter((specifier): specifier is string => Boolean(specifier && specifier.startsWith('.')))

  return helperSpecifiers
    .map((specifier) => {
      const helperPath = path.resolve(path.dirname(runtime.filePath), specifier)
      try {
        return readFileSync(helperPath, 'utf8')
      }
      catch (error) {
        throw new StatefulHmrRuntimeCompatibilityError(
          `无法读取 Rolldown dev runtime helper ${specifier}：${error instanceof Error ? error.message : String(error)}`,
        )
      }
    })
    .map(stripModuleSyntax)
    .join('\n')
}

function assertRolldownRuntimeContract(runtime: { source: string, filePath: string }, helpers: string): void {
  const contracts = [
    [runtime.source, /(?:class\s+DevRuntime|(?:var|let|const)\s+DevRuntime\s*=)/, 'DevRuntime'],
    [runtime.source, /(?:class\s+Module|(?:var|let|const)\s+Module\s*=)/, 'Module'],
    [helpers, /(?:var|let|const)\s+__exportAll\s*=|function\s+__exportAll\b/, 'common runtime helpers'],
  ] as const
  const missing = contracts.filter(([source, pattern]) => !pattern.test(source))
  if (missing.length > 0) {
    throw new StatefulHmrRuntimeCompatibilityError(
      `Rolldown dev runtime ${runtime.filePath} 缺少稳定契约：${missing.map(([, , name]) => name).join('、')}。`,
    )
  }
}

export function composeStatefulHmrRuntimeSource(runtime: { filePath: string, source: string }, helpers: string): string {
  assertRolldownRuntimeContract(runtime, helpers)
  return `${helpers}\n${stripModuleSyntax(runtime.source)}\n${statefulHmrRolldownRuntimeSource}`
}

export function createStatefulHmrRolldownRuntimeSource(): string {
  const runtime = readRolldownRuntimeSource('rolldown/experimental/runtime')
  const helpers = resolveRuntimeHelpers(runtime)
  return composeStatefulHmrRuntimeSource(runtime, helpers)
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
