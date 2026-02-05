import type { WeappLibConfig } from '../types'
import type { ConfigService, ResolvedWeappLibConfig } from './config/types'
import { isObject, removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { findJsEntry, findVueEntry } from '../utils/file'
import { normalizeRelativePath, stripLeadingSlashes } from '../utils/path'

export interface ResolvedWeappLibEntry {
  name: string
  input: string
  relativeBase: string
  outputBase: string
}

export function hasLibEntry(entry: WeappLibConfig['entry'] | undefined): boolean {
  if (!entry) {
    return false
  }
  if (typeof entry === 'string') {
    return entry.trim().length > 0
  }
  if (Array.isArray(entry)) {
    return entry.length > 0
  }
  if (isObject(entry)) {
    return Object.keys(entry).length > 0
  }
  return false
}

export function resolveWeappLibConfig(options: {
  cwd: string
  srcRoot: string
  config?: WeappLibConfig
}): ResolvedWeappLibConfig | undefined {
  const { cwd, srcRoot, config } = options
  if (!config) {
    return undefined
  }

  const root = config.root ?? srcRoot ?? ''
  const resolvedRoot = path.resolve(cwd, root || '.')

  return {
    enabled: hasLibEntry(config.entry),
    entry: config.entry,
    root: resolvedRoot,
    outDir: config.outDir,
    preservePath: config.preservePath !== false,
    fileName: config.fileName,
    componentJson: config.componentJson ?? 'auto',
    dts: config.dts !== false,
    source: config,
  }
}

function normalizeLibName(value: string) {
  return stripLeadingSlashes(normalizeRelativePath(value))
}

async function resolveEntryFile(root: string, entry: string) {
  const resolved = path.isAbsolute(entry)
    ? entry
    : path.resolve(root, entry)

  if (path.extname(resolved)) {
    if (await fs.pathExists(resolved)) {
      return resolved
    }
  }

  const jsEntry = await findJsEntry(resolved)
  if (jsEntry.path) {
    return jsEntry.path
  }

  const vueEntry = await findVueEntry(resolved)
  if (vueEntry) {
    return vueEntry
  }

  if (await fs.pathExists(resolved)) {
    return resolved
  }

  return undefined
}

function resolveEntryName(options: {
  explicitName?: string
  preservePath: boolean
  relativeId: string
}) {
  const { explicitName, preservePath, relativeId } = options
  if (explicitName) {
    return normalizeLibName(explicitName)
  }
  const base = removeExtensionDeep(relativeId)
  if (!preservePath) {
    return normalizeLibName(path.basename(base))
  }
  return normalizeLibName(base)
}

function resolveOutputBase(options: {
  entryName: string
  entryPath: string
  config: ResolvedWeappLibConfig
}) {
  const { entryName, entryPath, config } = options
  const fileName = config.fileName
  if (!fileName) {
    return normalizeLibName(entryName)
  }
  let resolved: string
  if (typeof fileName === 'function') {
    resolved = fileName({ name: entryName, input: entryPath })
    if (typeof resolved !== 'string') {
      throw new TypeError('`weapp.lib.fileName` 必须返回字符串。')
    }
  }
  else {
    resolved = fileName.includes('[name]')
      ? fileName.replace(/\[name\]/g, entryName)
      : fileName
  }

  const normalized = normalizeLibName(resolved)
  if (!normalized) {
    throw new Error('`weapp.lib.fileName` 解析结果为空，请检查配置。')
  }
  return normalizeLibName(removeExtensionDeep(normalized))
}

export function createLibEntryFileNameResolver(libConfig: ResolvedWeappLibConfig) {
  if (!libConfig.fileName) {
    return undefined
  }
  return (chunkInfo: { name: string, facadeModuleId?: string }) => {
    const base = resolveOutputBase({
      entryName: chunkInfo.name,
      entryPath: chunkInfo.facadeModuleId ?? '',
      config: libConfig,
    })
    return `${base}.js`
  }
}

export async function resolveWeappLibEntries(
  configService: ConfigService,
  libConfig: ResolvedWeappLibConfig,
) {
  const entry = libConfig.entry
  const root = libConfig.root || configService.absoluteSrcRoot
  const preservePath = libConfig.preservePath

  const entries: Array<{ name?: string, path: string }> = []

  if (typeof entry === 'string') {
    entries.push({ path: entry })
  }
  else if (Array.isArray(entry)) {
    for (const item of entry) {
      entries.push({ path: item })
    }
  }
  else if (isObject(entry)) {
    for (const [name, value] of Object.entries(entry)) {
      entries.push({ name, path: value })
    }
  }

  if (!entries.length) {
    throw new Error('`weapp.lib.entry` 不能为空，请配置库模式入口。')
  }

  if (typeof libConfig.fileName === 'string' && !libConfig.fileName.includes('[name]') && entries.length > 1) {
    throw new Error('`weapp.lib.fileName` 在多入口模式下必须包含 `[name]` 占位符。')
  }

  const outputNames = new Set<string>()
  const resolved: ResolvedWeappLibEntry[] = []

  for (const item of entries) {
    const entryPath = await resolveEntryFile(root, item.path)
    if (!entryPath) {
      throw new Error(`未找到 lib 入口文件：${item.path}`)
    }

    const relativeId = normalizeRelativePath(configService.relativeAbsoluteSrcRoot(entryPath))
    const entryName = resolveEntryName({
      explicitName: item.name,
      preservePath,
      relativeId,
    })
    if (!entryName) {
      throw new Error(`lib 入口解析失败：${item.path}`)
    }

    const outputBase = resolveOutputBase({
      entryName,
      entryPath,
      config: libConfig,
    })

    if (outputNames.has(outputBase)) {
      throw new Error(`lib 输出路径冲突：${outputBase}`)
    }
    outputNames.add(outputBase)

    const relativeBase = normalizeLibName(removeExtensionDeep(relativeId))

    resolved.push({
      name: entryName,
      input: entryPath,
      relativeBase,
      outputBase,
    })
  }

  return resolved
}

export function isLibMode(configService?: ConfigService) {
  return Boolean(configService?.weappLibConfig?.enabled)
}
