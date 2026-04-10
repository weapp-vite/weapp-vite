import type { MutableCompilerContext } from '../../context'
import type { LegacyManagedTsconfigFile, LegacyManagedTypeScriptConfig, ManagedTypeScriptConfig } from './types'
import { fs } from '@weapp-core/shared'
import { parse as parseJson } from 'comment-json'
import path from 'pathe'
import { resolveBaseDir, WEAPP_VITE_INTERNAL_DIRNAME } from '../autoImport/config/base'
import { requireConfigService } from '../utils/requireConfigService'

export const DEFAULT_APP_INCLUDE = [
  '../src/**/*',
  '../types/**/*.d.ts',
  '../env.d.ts',
  './**/*.d.ts',
]

export const DEFAULT_NODE_INCLUDE = [
  '../vite.config.ts',
  '../vite.config.*.ts',
  '../vite.config.mts',
  '../vite.config.*.mts',
  '../*.config.ts',
  '../*.config.mts',
  '../config/**/*.ts',
  '../config/**/*.mts',
  '../scripts/**/*.ts',
  '../scripts/**/*.mts',
]

const WINDOWS_PATH_SEPARATOR_PATTERN = /\\/g
const LEADING_DOT_SLASH_PATTERN = /^\.\/+/
const TRAILING_SLASH_PATTERN = /\/+$/

export function hasDependency(packageJson: Record<string, any> | undefined, name: string) {
  return Boolean(
    packageJson?.dependencies?.[name]
    || packageJson?.devDependencies?.[name]
    || packageJson?.peerDependencies?.[name],
  )
}

export function unique(values: string[]) {
  return [...new Set(values)]
}

function rebaseManagedPathValue(root: string, managedDir: string, value: string) {
  if (!value.startsWith('./') && !value.startsWith('../')) {
    return value
  }
  return path.relative(managedDir, path.resolve(root, value)).replace(WINDOWS_PATH_SEPARATOR_PATTERN, '/')
}

export function rebaseManagedPaths(root: string, managedDir: string, paths?: Record<string, string[]>) {
  if (!paths) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(paths).map(([key, values]) => [
      key,
      Array.isArray(values) ? values.map(value => rebaseManagedPathValue(root, managedDir, value)) : [],
    ]),
  )
}

export function mergePaths(...entries: Array<Record<string, string[]> | undefined>) {
  const merged: Record<string, string[]> = {}
  for (const entry of entries) {
    if (!entry) {
      continue
    }
    for (const [key, value] of Object.entries(entry)) {
      merged[key] = Array.isArray(value) ? [...value] : []
    }
  }
  return merged
}

export function toJson(content: Record<string, any>) {
  return `${JSON.stringify(content, null, 2)}\n`
}

export function resolveManagedDir(ctx: MutableCompilerContext) {
  return path.resolve(resolveBaseDir(requireConfigService(ctx, '生成托管 tsconfig 前必须初始化 configService。')), WEAPP_VITE_INTERNAL_DIRNAME)
}

export function getManagedTypeScriptConfig(ctx: MutableCompilerContext): ManagedTypeScriptConfig | undefined {
  return requireConfigService(ctx, '读取托管 tsconfig 配置前必须初始化 configService。').weappViteConfig.typescript as ManagedTypeScriptConfig | undefined
}

async function readLegacyManagedTsconfigFile(filePath: string): Promise<LegacyManagedTsconfigFile | undefined> {
  if (!await fs.pathExists(filePath)) {
    return undefined
  }

  try {
    const content = await fs.readFile(filePath, 'utf8')
    const parsed = parseJson(content, undefined, true)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }
    return parsed as LegacyManagedTsconfigFile
  }
  catch {
    return undefined
  }
}

export async function getLegacyManagedTypeScriptConfig(ctx: MutableCompilerContext): Promise<LegacyManagedTypeScriptConfig> {
  const root = resolveBaseDir(requireConfigService(ctx, '读取旧 tsconfig 配置前必须初始化 configService。'))
  const [shared, app, node, server] = await Promise.all([
    readLegacyManagedTsconfigFile(path.join(root, 'tsconfig.shared.json')),
    readLegacyManagedTsconfigFile(path.join(root, 'tsconfig.app.json')),
    readLegacyManagedTsconfigFile(path.join(root, 'tsconfig.node.json')),
    readLegacyManagedTsconfigFile(path.join(root, 'tsconfig.server.json')),
  ])

  return {
    shared,
    app,
    node,
    server,
  }
}

export function normalizeSrcRoot(srcRoot: string | undefined) {
  return typeof srcRoot === 'string'
    ? srcRoot
      .replace(WINDOWS_PATH_SEPARATOR_PATTERN, '/')
      .replace(LEADING_DOT_SLASH_PATTERN, '')
      .replace(TRAILING_SLASH_PATTERN, '')
      || 'src'
    : 'src'
}
