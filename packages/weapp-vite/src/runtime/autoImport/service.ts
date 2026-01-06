import type { ResolvedValue, Resolver } from '../../auto-import-components/resolvers'
import type { MutableCompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import type { ComponentPropMap } from '../componentProps'
import type { HtmlCustomDataSettings, TypedComponentsSettings, VueComponentsSettings } from './config'
import type { ComponentMetadata } from './metadata'
import type { LocalAutoImportMatch } from './types'
import { createRequire } from 'node:module'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import pm from 'picomatch'
import { logger, resolvedComponentName } from '../../context/shared'
import { findJsEntry, findJsonEntry, findTemplateEntry } from '../../utils'
import { extractComponentProps } from '../componentProps'
import { requireConfigService } from '../utils/requireConfigService'
import {
  DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME,
  getAutoImportConfig,
  getHtmlCustomDataSettings,
  getTypedComponentsSettings,
  getVueComponentsSettings,
  resolveManifestOutputPath,
} from './config'
import { loadExternalComponentMetadata } from './externalMetadata'
import { createHtmlCustomDataDefinition } from './htmlCustomData'
import { extractJsonPropMetadata, mergePropMaps } from './metadata'
import { createTypedComponentsDefinition } from './typedDefinition'
import { createVueComponentsDefinition } from './vueDefinition'

export type { LocalAutoImportMatch } from './types'

const require = createRequire(import.meta.url)

const logWarnCache = new LRUCache<string, boolean>({
  max: 512,
  ttl: 1000 * 60 * 60,
})

function logWarnOnce(message: string) {
  if (logWarnCache.get(message)) {
    return
  }
  logger.warn(message)
  logWarnCache.set(message, true)
}

export interface ResolverAutoImportMatch {
  kind: 'resolver'
  value: ResolvedValue
}

export type AutoImportMatch = LocalAutoImportMatch | ResolverAutoImportMatch

export interface AutoImportService {
  reset: () => void
  registerPotentialComponent: (filePath: string) => Promise<void>
  removePotentialComponent: (filePath: string) => void
  resolve: (componentName: string, importerBaseName?: string) => AutoImportMatch | undefined
  filter: (id: string, meta?: SubPackageMetaValue) => boolean
  getRegisteredLocalComponents: () => LocalAutoImportMatch[]
  awaitManifestWrites: () => Promise<void>
}

function resolveWithResolver(resolver: Resolver, componentName: string, baseName: string) {
  if (!resolver) {
    return undefined
  }

  const candidates: string[] = [componentName]
  if (!componentName.includes('-') && /[A-Z]/.test(componentName)) {
    const kebab = componentName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .toLowerCase()
    if (kebab && kebab !== componentName) {
      candidates.push(kebab)
    }
  }

  // 优先按对象 resolver 处理（即使 resolver 本身是可调用函数，但额外挂了字段）。
  const resolverAny = resolver as any
  for (const candidate of candidates) {
    if (typeof resolverAny.resolve === 'function') {
      const resolved = resolverAny.resolve(candidate, baseName)
      if (resolved) {
        return candidate === componentName ? resolved : { name: componentName, from: resolved.from }
      }
    }

    const from = resolverAny.components?.[candidate]
    if (from) {
      return { name: componentName, from }
    }

    // 兜底：兼容函数写法 resolver。
    if (typeof resolver === 'function') {
      const resolved = resolver(candidate, baseName)
      if (resolved) {
        return candidate === componentName ? resolved : { name: componentName, from: resolved.from }
      }
    }
  }

  return undefined
}

export function createAutoImportService(ctx: MutableCompilerContext): AutoImportService {
  const autoImportState = ctx.runtimeState.autoImport
  const registry = autoImportState.registry
  const manifestFileName = DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME
  const manifestCache = new Map<string, string>()
  let pendingWrite: Promise<void> | undefined
  let writeRequested = false
  const componentMetadataMap = new Map<string, ComponentMetadata>()
  const resolverComponentNames = new Set<string>()
  let resolverComponentsMap: Record<string, string> = {}
  let pendingTypedWrite: Promise<void> | undefined
  let typedWriteRequested = false
  let lastWrittenTypedDefinition: string | undefined
  let lastTypedDefinitionOutputPath: string | undefined
  let pendingHtmlCustomDataWrite: Promise<void> | undefined
  let htmlCustomDataWriteRequested = false
  let lastWrittenHtmlCustomData: string | undefined
  let lastHtmlCustomDataOutputPath: string | undefined
  let pendingVueComponentsWrite: Promise<void> | undefined
  let vueComponentsWriteRequested = false
  let lastWrittenVueComponentsDefinition: string | undefined
  let lastVueComponentsOutputPath: string | undefined

  const miniprogramDirCache = new Map<string, string | undefined>()

  function parsePackageSpecifier(specifier: string) {
    const normalized = specifier.trim()
    if (!normalized || normalized.startsWith('.') || normalized.startsWith('/') || normalized.startsWith('\\')) {
      return undefined
    }
    // Windows 绝对路径（如 C:\...）
    if (/^[a-z]:[\\/]/i.test(normalized)) {
      return undefined
    }

    const parts = normalized.split('/').filter(Boolean)
    if (parts.length === 0) {
      return undefined
    }

    if (normalized.startsWith('@')) {
      if (parts.length < 2) {
        return undefined
      }
      return {
        pkgName: `${parts[0]}/${parts[1]}`,
        subpath: parts.slice(2).join('/'),
      }
    }

    return {
      pkgName: parts[0],
      subpath: parts.slice(1).join('/'),
    }
  }

  function getMiniprogramDir(pkgName: string, cwd: string) {
    if (miniprogramDirCache.has(pkgName)) {
      return miniprogramDirCache.get(pkgName)
    }
    try {
      const packageJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [cwd] })
      const raw = fs.readJsonSync(packageJsonPath, { throws: false }) as { miniprogram?: unknown } | undefined
      const miniprogram = typeof raw?.miniprogram === 'string' ? raw.miniprogram.trim() : undefined
      const normalized = miniprogram?.replace(/^[./]+/, '').replace(/\/+$/, '')
      miniprogramDirCache.set(pkgName, normalized || undefined)
      return normalized || undefined
    }
    catch {
      miniprogramDirCache.set(pkgName, undefined)
      return undefined
    }
  }

  function resolveNavigationImport(from: string) {
    const configService = ctx.configService
    const cwd = configService?.cwd
    if (!cwd) {
      return undefined
    }

    const parsed = parsePackageSpecifier(from)
    if (!parsed || !parsed.pkgName || !parsed.subpath) {
      return undefined
    }

    const miniprogramDir = getMiniprogramDir(parsed.pkgName, cwd)
    const withMiniprogramDir = miniprogramDir && !parsed.subpath.startsWith(`${miniprogramDir}/`) && parsed.subpath !== miniprogramDir
      ? `${parsed.pkgName}/${miniprogramDir}/${parsed.subpath}`
      : `${parsed.pkgName}/${parsed.subpath}`

    const candidates: string[] = []
    if (!/\.(?:[cm]?js|tsx?|jsx|d\.ts)$/.test(withMiniprogramDir)) {
      candidates.push(`${withMiniprogramDir}.js`)
      candidates.push(`${withMiniprogramDir}/index.js`)
    }
    candidates.push(withMiniprogramDir)

    for (const candidate of candidates) {
      try {
        require.resolve(candidate, { paths: [cwd] })
        return candidate
      }
      catch {
        // 继续尝试下一个候选路径
      }
    }

    return undefined
  }

  function collectResolverComponents(): Record<string, string> {
    const resolvers = getAutoImportConfig(ctx.configService)?.resolvers
    if (!Array.isArray(resolvers)) {
      return {}
    }

    const entries: [string, string][] = []
    for (const resolver of resolvers as Resolver[]) {
      const map = resolver?.components
      if (!map) {
        continue
      }
      for (const [name, from] of Object.entries(map)) {
        entries.push([name, from])
      }
    }

    return Object.fromEntries(entries)
  }

  function syncResolverComponentProps() {
    const resolverEntries = collectResolverComponents()
    resolverComponentsMap = resolverEntries
    resolverComponentNames.clear()
    for (const name of Object.keys(resolverEntries)) {
      resolverComponentNames.add(name)
      if (!componentMetadataMap.has(name)) {
        componentMetadataMap.set(name, { types: new Map(), docs: new Map() })
      }
    }
    for (const key of Array.from(componentMetadataMap.keys())) {
      if (resolverComponentNames.has(key)) {
        continue
      }
      if (registry.has(key)) {
        continue
      }
      componentMetadataMap.delete(key)
    }
  }

  function getComponentMetadata(name: string): ComponentMetadata {
    if (resolverComponentNames.has(name)) {
      const existing = componentMetadataMap.get(name)
      if (existing && existing.types.size > 0) {
        return {
          types: new Map(existing.types),
          docs: new Map(existing.docs),
        }
      }

      const from = resolverComponentsMap[name]
      const cwd = ctx.configService?.cwd
      if (from && cwd) {
        try {
          const resolvers = getAutoImportConfig(ctx.configService)?.resolvers as Resolver[] | undefined
          const loaded = loadExternalComponentMetadata(from, cwd, resolvers)
          if (loaded?.types?.size) {
            componentMetadataMap.set(name, { types: new Map(loaded.types), docs: new Map() })
            return {
              types: new Map(loaded.types),
              docs: new Map(),
            }
          }
        }
        catch {
          // 忽略
        }
      }
    }

    const existing = componentMetadataMap.get(name)
    if (existing) {
      return {
        types: new Map(existing.types),
        docs: new Map(existing.docs),
      }
    }

    const record = registry.get(name)
    if (record && record.kind === 'local') {
      let metadata = extractJsonPropMetadata(record.entry.json as Record<string, any>)
      const candidatePaths = new Set<string>()
      if (record.entry.jsonPath) {
        candidatePaths.add(record.entry.jsonPath)
      }
      const configService = ctx.configService
      if (configService) {
        const from = record.value.from?.replace(/^\//, '')
        if (from) {
          candidatePaths.add(path.resolve(configService.absoluteSrcRoot, `${from}.json`))
        }
        const manifestFrom = manifestCache.get(name)?.replace(/^\//, '')
        if (manifestFrom) {
          candidatePaths.add(path.resolve(configService.absoluteSrcRoot, `${manifestFrom}.json`))
        }
      }

      if (metadata.props.size === 0 && metadata.docs.size === 0 && candidatePaths.size > 0) {
        for (const candidate of candidatePaths) {
          try {
            const raw = fs.readJsonSync(candidate)
            metadata = extractJsonPropMetadata(raw)
            if (metadata.props.size > 0 || metadata.docs.size > 0) {
              logger.debug?.(`[auto-import] loaded metadata for ${name} from ${candidate}`)
              break
            }
          }
          catch {
            // 文件不存在时忽略
          }
        }
      }
      logger.debug?.(`[auto-import] metadata for ${name}: props=${metadata.props.size} docs=${metadata.docs.size}`)
      return {
        types: new Map(metadata.props),
        docs: new Map(metadata.docs),
      }
    }
    return { types: new Map<string, string>(), docs: new Map<string, string>() }
  }

  function collectAllComponentNames(): string[] {
    const resolverEntries = collectResolverComponents()
    const names = new Set<string>([...Object.keys(resolverEntries)])
    for (const key of registry.keys()) {
      names.add(key)
    }
    for (const key of componentMetadataMap.keys()) {
      names.add(key)
    }
    for (const key of manifestCache.keys()) {
      names.add(key)
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }

  function preloadResolverComponentMetadata() {
    const cwd = ctx.configService?.cwd
    if (!cwd) {
      return
    }

    const resolvers = getAutoImportConfig(ctx.configService)?.resolvers as Resolver[] | undefined
    const resolverEntries = collectResolverComponents()
    if (!resolverEntries || Object.keys(resolverEntries).length === 0) {
      return
    }

    for (const [name, from] of Object.entries(resolverEntries)) {
      if (!from) {
        continue
      }
      const existing = componentMetadataMap.get(name)
      if (existing && existing.types.size > 0) {
        continue
      }
      try {
        const loaded = loadExternalComponentMetadata(from, cwd, resolvers)
        if (loaded?.types?.size) {
          componentMetadataMap.set(name, { types: new Map(loaded.types), docs: new Map() })
        }
      }
      catch {
        // 忽略
      }
    }
  }

  async function syncTypedComponentsDefinition(settings: TypedComponentsSettings) {
    if (!settings.enabled || !settings.outputPath) {
      if (lastTypedDefinitionOutputPath) {
        try {
          await fs.remove(lastTypedDefinitionOutputPath)
        }
        catch { }
      }
      lastTypedDefinitionOutputPath = undefined
      lastWrittenTypedDefinition = undefined
      return
    }

    syncResolverComponentProps()
    preloadResolverComponentMetadata()

    const componentNames = collectAllComponentNames()
    const nextDefinition = createTypedComponentsDefinition(componentNames, getComponentMetadata)
    if (nextDefinition === lastWrittenTypedDefinition && settings.outputPath === lastTypedDefinitionOutputPath) {
      return
    }

    try {
      if (lastTypedDefinitionOutputPath && lastTypedDefinitionOutputPath !== settings.outputPath) {
        try {
          await fs.remove(lastTypedDefinitionOutputPath)
        }
        catch { }
      }
      await fs.outputFile(settings.outputPath, nextDefinition, 'utf8')
      lastWrittenTypedDefinition = nextDefinition
      lastTypedDefinitionOutputPath = settings.outputPath
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`写入 typed-components.d.ts 失败: ${message}`)
    }
  }

  async function syncVueComponentsDefinition(settings: VueComponentsSettings) {
    if (!settings.enabled || !settings.outputPath) {
      if (lastVueComponentsOutputPath) {
        try {
          await fs.remove(lastVueComponentsOutputPath)
        }
        catch { }
      }
      lastVueComponentsOutputPath = undefined
      lastWrittenVueComponentsDefinition = undefined
      return
    }

    syncResolverComponentProps()
    preloadResolverComponentMetadata()

    const componentNames = collectAllComponentNames()
    const nextDefinition = createVueComponentsDefinition(componentNames, getComponentMetadata, {
      useTypedComponents: getTypedComponentsSettings(ctx).enabled,
      resolveComponentImport: (name) => {
        const from = resolverComponentsMap[name]
        if (!from) {
          return undefined
        }
        return resolveNavigationImport(from)
      },
    })
    if (nextDefinition === lastWrittenVueComponentsDefinition && settings.outputPath === lastVueComponentsOutputPath) {
      return
    }

    try {
      if (lastVueComponentsOutputPath && lastVueComponentsOutputPath !== settings.outputPath) {
        try {
          await fs.remove(lastVueComponentsOutputPath)
        }
        catch { }
      }
      await fs.outputFile(settings.outputPath, nextDefinition, 'utf8')
      lastWrittenVueComponentsDefinition = nextDefinition
      lastVueComponentsOutputPath = settings.outputPath
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`写入 components.d.ts 失败: ${message}`)
    }
  }

  async function syncHtmlCustomData(settings: HtmlCustomDataSettings) {
    if (!settings.enabled || !settings.outputPath) {
      if (lastHtmlCustomDataOutputPath) {
        try {
          await fs.remove(lastHtmlCustomDataOutputPath)
        }
        catch { }
      }
      lastHtmlCustomDataOutputPath = undefined
      lastWrittenHtmlCustomData = undefined
      return
    }

    syncResolverComponentProps()
    preloadResolverComponentMetadata()

    const componentNames = collectAllComponentNames()
    const nextDefinition = createHtmlCustomDataDefinition(componentNames, getComponentMetadata)
    if (nextDefinition === lastWrittenHtmlCustomData && settings.outputPath === lastHtmlCustomDataOutputPath) {
      return
    }

    try {
      if (lastHtmlCustomDataOutputPath && lastHtmlCustomDataOutputPath !== settings.outputPath) {
        try {
          await fs.remove(lastHtmlCustomDataOutputPath)
        }
        catch { }
      }
      await fs.outputFile(settings.outputPath, nextDefinition, 'utf8')
      lastWrittenHtmlCustomData = nextDefinition
      lastHtmlCustomDataOutputPath = settings.outputPath
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`写入 mini-program.html-data.json 失败: ${message}`)
    }
  }
  let lastHtmlCustomDataEnabled = false
  let lastHtmlCustomDataOutput: string | undefined

  function scheduleHtmlCustomDataWrite(shouldWrite: boolean) {
    const settings = getHtmlCustomDataSettings(ctx)
    const configChanged = settings.enabled !== lastHtmlCustomDataEnabled
      || settings.outputPath !== lastHtmlCustomDataOutput

    if (!shouldWrite && !configChanged && !lastHtmlCustomDataOutputPath) {
      return
    }

    htmlCustomDataWriteRequested = true
    if (pendingHtmlCustomDataWrite) {
      return
    }

    pendingHtmlCustomDataWrite = Promise.resolve()
      .then(async () => {
        while (htmlCustomDataWriteRequested) {
          htmlCustomDataWriteRequested = false
          const currentSettings = getHtmlCustomDataSettings(ctx)
          await syncHtmlCustomData(currentSettings)
          lastHtmlCustomDataEnabled = currentSettings.enabled
          lastHtmlCustomDataOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        pendingHtmlCustomDataWrite = undefined
      })
  }

  async function writeManifestFile(outputPath: string) {
    const resolverEntries = Object.entries(collectResolverComponents())
    const localEntries = Array.from(registry.entries())
      .filter((entry): entry is [string, LocalAutoImportMatch] => entry[1].kind === 'local')

    const manifestMap = new Map<string, string>()
    for (const [componentName, from] of resolverEntries) {
      manifestMap.set(componentName, from)
    }
    for (const [componentName, match] of localEntries) {
      manifestMap.set(componentName, match.value.from)
    }

    const manifest = Object.fromEntries(
      Array.from(manifestMap.entries()).sort(([a], [b]) => a.localeCompare(b)),
    )

    manifestCache.clear()
    for (const [componentName, fromPath] of manifestMap.entries()) {
      manifestCache.set(componentName, fromPath)
    }

    await fs.outputJson(outputPath, manifest, { spaces: 2 })
    scheduleHtmlCustomDataWrite(true)
  }

  let lastTypedComponentsEnabled = false
  let lastTypedComponentsOutput: string | undefined

  function scheduleTypedComponentsWrite(shouldWrite: boolean) {
    const settings = getTypedComponentsSettings(ctx)
    const configChanged = settings.enabled !== lastTypedComponentsEnabled
      || settings.outputPath !== lastTypedComponentsOutput

    if (!shouldWrite && !configChanged && !lastTypedDefinitionOutputPath) {
      return
    }

    typedWriteRequested = true
    if (pendingTypedWrite) {
      return
    }

    pendingTypedWrite = Promise.resolve()
      .then(async () => {
        while (typedWriteRequested) {
          typedWriteRequested = false
          const currentSettings = getTypedComponentsSettings(ctx)
          await syncTypedComponentsDefinition(currentSettings)
          lastTypedComponentsEnabled = currentSettings.enabled
          lastTypedComponentsOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        pendingTypedWrite = undefined
      })
  }

  function scheduleManifestWrite(shouldWrite: boolean) {
    if (!shouldWrite) {
      return
    }

    const configService = ctx.configService
    if (!getAutoImportConfig(configService)) {
      return
    }

    writeRequested = true
    if (pendingWrite) {
      return
    }

    pendingWrite = Promise.resolve()
      .then(async () => {
        while (writeRequested) {
          writeRequested = false
          const outputPath = resolveManifestOutputPath(ctx.configService, manifestFileName)
          if (!outputPath) {
            return
          }
          try {
            await writeManifestFile(outputPath)
          }
          catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.error(`自动导出组件清单失败: ${message}`)
          }
        }
      })
      .finally(() => {
        pendingWrite = undefined
      })
  }

  let lastVueComponentsEnabled = false
  let lastVueComponentsOutput: string | undefined

  function scheduleVueComponentsWrite(shouldWrite: boolean) {
    const settings = getVueComponentsSettings(ctx)
    const configChanged = settings.enabled !== lastVueComponentsEnabled
      || settings.outputPath !== lastVueComponentsOutput

    if (!shouldWrite && !configChanged && !lastVueComponentsOutputPath) {
      return
    }

    vueComponentsWriteRequested = true
    if (pendingVueComponentsWrite) {
      return
    }

    pendingVueComponentsWrite = Promise.resolve()
      .then(async () => {
        while (vueComponentsWriteRequested) {
          vueComponentsWriteRequested = false
          const currentSettings = getVueComponentsSettings(ctx)
          await syncVueComponentsDefinition(currentSettings)
          lastVueComponentsEnabled = currentSettings.enabled
          lastVueComponentsOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        pendingVueComponentsWrite = undefined
      })
  }

  function removeRegisteredComponent(paths: {
    baseName?: string
    templatePath?: string
    jsEntry?: string
    jsonPath?: string
  }) {
    const { baseName, templatePath, jsEntry, jsonPath } = paths
    let removed = false
    const removedNames: string[] = []
    for (const [key, value] of registry) {
      if (value.kind !== 'local') {
        continue
      }
      const entry = value.entry
      const matches = Boolean(
        (templatePath && entry.templatePath === templatePath)
        || (jsonPath && entry.jsonPath === jsonPath)
        || (jsEntry && entry.path === jsEntry)
        || (baseName && removeExtensionDeep(entry.templatePath) === baseName)
        || (baseName && removeExtensionDeep(entry.path) === baseName)
        || (baseName && removeExtensionDeep(entry.jsonPath ?? '') === baseName),
      )

      if (matches) {
        if (registry.delete(key)) {
          removed = true
          removedNames.push(key)
        }
      }
    }

    return { removed, removedNames }
  }

  async function registerLocalComponent(filePath: string) {
    if (!ctx.configService || !ctx.jsonService) {
      throw new Error('configService/jsonService must be initialized before scanning components')
    }

    const baseName = removeExtensionDeep(filePath)
    const [{ path: jsEntry }, { path: jsonPath }, { path: templatePath }] = await Promise.all([
      findJsEntry(baseName),
      findJsonEntry(baseName),
      findTemplateEntry(baseName),
    ])

    const { removed, removedNames } = removeRegisteredComponent({
      baseName,
      templatePath,
      jsEntry,
      jsonPath,
    })

    for (const name of removedNames) {
      if (resolverComponentNames.has(name)) {
        componentMetadataMap.set(name, { types: new Map(), docs: new Map() })
      }
      else {
        componentMetadataMap.delete(name)
      }
    }

    if (!jsEntry || !jsonPath || !templatePath) {
      scheduleManifestWrite(removed)
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      scheduleVueComponentsWrite(getVueComponentsSettings(ctx).enabled || removed || removedNames.length > 0)
      return
    }

    const json = await ctx.jsonService.read(jsonPath)
    if (!json?.component) {
      scheduleManifestWrite(removed)
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      scheduleVueComponentsWrite(getVueComponentsSettings(ctx).enabled || removed || removedNames.length > 0)
      return
    }

    const { componentName, base } = resolvedComponentName(baseName)
    if (!componentName) {
      scheduleManifestWrite(removed)
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      scheduleVueComponentsWrite(getVueComponentsSettings(ctx).enabled || removed || removedNames.length > 0)
      return
    }

    const hasComponent = registry.has(componentName)
    if (hasComponent && base !== 'index') {
      const message = `发现 \`${componentName}\` 组件重名! 跳过组件 \`${ctx.configService.relativeCwd(baseName)}\` 的自动引入`
      logWarnOnce(message)
      scheduleManifestWrite(removed)
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      scheduleVueComponentsWrite(getVueComponentsSettings(ctx).enabled || removed || removedNames.length > 0)
      return
    }

    const sourceWithoutExt = removeExtensionDeep(jsonPath)
    const from = `/${ctx.configService.relativeSrcRoot(
      ctx.configService.relativeCwd(sourceWithoutExt),
    )}`

    registry.set(componentName, {
      kind: 'local',
      entry: {
        path: jsEntry,
        json,
        jsonPath,
        type: 'component',
        templatePath,
      },
      value: {
        name: componentName,
        from,
      },
    })

    scheduleManifestWrite(true)

    const typedSettings = getTypedComponentsSettings(ctx)
    const htmlSettings = getHtmlCustomDataSettings(ctx)
    const vueSettings = getVueComponentsSettings(ctx)
    const shouldCollectProps = typedSettings.enabled || htmlSettings.enabled

    if (shouldCollectProps) {
      let metadataSource: Record<string, any> | undefined = json
      try {
        metadataSource = await fs.readJson(jsonPath)
      }
      catch {
        // 忽略读取失败，回退到 jsonService 提供的 json
      }

      const metadata = extractJsonPropMetadata(metadataSource)
      const baseProps = metadata.props
      let propMap: ComponentPropMap = new Map(baseProps)

      if (typedSettings.enabled) {
        try {
          const code = await fs.readFile(jsEntry, 'utf8')
          const props = extractComponentProps(code)
          propMap = mergePropMaps(baseProps, props)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logger.error(`解析组件 \`${ctx.configService.relativeCwd(jsEntry)}\` 属性失败: ${message}`)
          propMap = new Map(baseProps)
        }
      }

      componentMetadataMap.set(componentName, {
        types: new Map(propMap),
        docs: new Map(metadata.docs),
      })
    }
    else {
      componentMetadataMap.delete(componentName)
    }

    scheduleTypedComponentsWrite(typedSettings.enabled || removed || removedNames.length > 0)
    scheduleHtmlCustomDataWrite(htmlSettings.enabled || removed || removedNames.length > 0)
    scheduleVueComponentsWrite(vueSettings.enabled || removed || removedNames.length > 0)
  }

  function ensureMatcher() {
    const configService = requireConfigService(ctx, 'configService must be initialized before filtering components')
    const globs = getAutoImportConfig(configService)?.globs
    if (!globs || globs.length === 0) {
      autoImportState.matcher = undefined
      autoImportState.matcherKey = ''
      return undefined
    }

    const nextKey = globs.join('\0')
    if (!autoImportState.matcher || autoImportState.matcherKey !== nextKey) {
      autoImportState.matcher = pm(globs, {
        cwd: configService.cwd,
        windows: true,
        posixSlashes: true,
      })
      autoImportState.matcherKey = nextKey
    }

    return autoImportState.matcher
  }

  function resolveWithResolvers(componentName: string, importerBaseName?: string): ResolverAutoImportMatch | undefined {
    const resolvers = getAutoImportConfig(ctx.configService)?.resolvers
    if (!Array.isArray(resolvers)) {
      return undefined
    }

    for (const resolver of resolvers) {
      const value = resolveWithResolver(resolver, componentName, importerBaseName ?? '')
      if (value) {
        return {
          kind: 'resolver',
          value,
        }
      }
    }

    return undefined
  }

  return {
    reset() {
      registry.clear()
      autoImportState.matcher = undefined
      autoImportState.matcherKey = ''
      scheduleManifestWrite(true)
      componentMetadataMap.clear()
      resolverComponentNames.clear()
      const typedSettings = getTypedComponentsSettings(ctx)
      const htmlSettings = getHtmlCustomDataSettings(ctx)
      const vueSettings = getVueComponentsSettings(ctx)
      if (typedSettings.enabled || htmlSettings.enabled) {
        syncResolverComponentProps()
      }
      scheduleTypedComponentsWrite(true)
      scheduleHtmlCustomDataWrite(true)
      if (vueSettings.enabled) {
        syncResolverComponentProps()
      }
      scheduleVueComponentsWrite(true)
    },

    async registerPotentialComponent(filePath: string) {
      await registerLocalComponent(filePath)
    },

    removePotentialComponent(filePath: string) {
      const { removed, removedNames } = removeRegisteredComponent({
        baseName: removeExtensionDeep(filePath),
        templatePath: filePath,
      })
      scheduleManifestWrite(removed)
      for (const name of removedNames) {
        if (resolverComponentNames.has(name)) {
          componentMetadataMap.set(name, { types: new Map(), docs: new Map() })
        }
        else {
          componentMetadataMap.delete(name)
        }
      }
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      scheduleVueComponentsWrite(removed || removedNames.length > 0)
    },

    resolve(componentName: string, importerBaseName?: string) {
      const local = registry.get(componentName)
      if (local) {
        return local
      }

      const resolved = resolveWithResolvers(componentName, importerBaseName)
      if (resolved) {
        const typedSettings = getTypedComponentsSettings(ctx)
        const htmlSettings = getHtmlCustomDataSettings(ctx)
        const vueSettings = getVueComponentsSettings(ctx)
        if (typedSettings.enabled || htmlSettings.enabled) {
          if (!componentMetadataMap.has(resolved.value.name)) {
            componentMetadataMap.set(resolved.value.name, { types: new Map(), docs: new Map() })
          }
          if (typedSettings.enabled) {
            scheduleTypedComponentsWrite(true)
          }
          if (htmlSettings.enabled) {
            scheduleHtmlCustomDataWrite(true)
          }
        }
        else {
          componentMetadataMap.delete(resolved.value.name)
        }
        if (vueSettings.enabled) {
          scheduleVueComponentsWrite(true)
        }
      }
      return resolved
    },

    filter(id: string, _meta?: SubPackageMetaValue) {
      const globMatcher = ensureMatcher()
      if (!globMatcher) {
        return false
      }
      return globMatcher(id)
    },

    getRegisteredLocalComponents() {
      return Array.from(registry.values())
    },
    awaitManifestWrites() {
      return Promise.all([
        pendingWrite ?? Promise.resolve(),
        pendingTypedWrite ?? Promise.resolve(),
        pendingHtmlCustomDataWrite ?? Promise.resolve(),
        pendingVueComponentsWrite ?? Promise.resolve(),
      ]).then(() => {})
    },
  }
}
