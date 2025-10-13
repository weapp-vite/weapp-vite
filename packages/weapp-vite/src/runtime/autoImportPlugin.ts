import type { Plugin } from 'vite'
import type { ResolvedValue, Resolver } from '../auto-import-components/resolvers'
import type { MutableCompilerContext } from '../context'
import type { SubPackageMetaValue } from '../types'
import type { LocalAutoImportMatch } from './autoImport/types'
import type { ComponentPropMap } from './componentProps'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import pm from 'picomatch'
import { logger, resolvedComponentName } from '../context/shared'
import { findJsEntry, findJsonEntry, findTemplateEntry } from '../utils'
import { extractComponentProps } from './componentProps'

export type { LocalAutoImportMatch } from './autoImport/types'

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

function getAutoImportConfig(configService?: MutableCompilerContext['configService']) {
  const weappConfig = configService?.weappViteConfig
  return weappConfig?.autoImportComponents ?? weappConfig?.enhance?.autoImportComponents
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

function createAutoImportService(ctx: MutableCompilerContext): AutoImportService {
  const autoImportState = ctx.runtimeState.autoImport
  const registry = autoImportState.registry
  const manifestFileName = 'auto-import-components.json'
  let pendingWrite: Promise<void> | undefined
  let writeRequested = false
  const componentPropsMap = new Map<string, ComponentPropMap>()
  const resolverComponentNames = new Set<string>()
  let pendingTypedWrite: Promise<void> | undefined
  let typedWriteRequested = false
  let lastWrittenTypedDefinition: string | undefined
  let lastTypedDefinitionOutputPath: string | undefined

  function resolveManifestOutputPath(): string | undefined {
    const configService = ctx.configService
    if (!configService) {
      return undefined
    }

    const autoImportConfig = getAutoImportConfig(configService)
    if (!autoImportConfig) {
      return undefined
    }

    const baseDir = (() => {
      const configFilePath = configService.configFilePath
      if (configFilePath) {
        return path.dirname(configFilePath)
      }
      return configService.cwd
    })()

    const outputOption = autoImportConfig.output
    if (outputOption === false) {
      return undefined
    }

    if (typeof outputOption === 'string' && outputOption.length > 0) {
      return path.isAbsolute(outputOption) ? outputOption : path.resolve(baseDir, outputOption)
    }

    return path.resolve(baseDir, manifestFileName)
  }

  function resolveTypedComponentsDefaultPath(configService: NonNullable<MutableCompilerContext['configService']>) {
    const baseDir = configService.configFilePath
      ? path.dirname(configService.configFilePath)
      : configService.cwd
    return path.resolve(baseDir, 'typed-components.d.ts')
  }

  interface TypedComponentsSettings {
    enabled: boolean
    outputPath?: string
  }

  function getTypedComponentsSettings(): TypedComponentsSettings {
    const configService = ctx.configService
    if (!configService) {
      return { enabled: false }
    }

    const autoImportConfig = getAutoImportConfig(configService)
    const option = autoImportConfig?.typedComponents

    if (option === true) {
      return {
        enabled: true,
        outputPath: resolveTypedComponentsDefaultPath(configService),
      }
    }

    if (typeof option === 'string') {
      const trimmed = option.trim()
      if (!trimmed) {
        return { enabled: false }
      }
      const baseDir = configService.configFilePath
        ? path.dirname(configService.configFilePath)
        : configService.cwd
      const resolved = path.isAbsolute(trimmed)
        ? trimmed
        : path.resolve(baseDir, trimmed)
      return {
        enabled: true,
        outputPath: resolved,
      }
    }

    return { enabled: false }
  }

  function isValidIdentifierName(name: string) {
    return /^[A-Z_$][\w$]*$/i.test(name)
  }

  function formatPropertyKey(name: string) {
    if (isValidIdentifierName(name)) {
      return name
    }
    const escaped = name
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '\\\'')
    return `'${escaped}'`
  }

  function formatComponentEntry(name: string, props?: ComponentPropMap) {
    const indent = '    '
    const key = formatPropertyKey(name)

    if (!props || props.size === 0) {
      return `${indent}${key}: Record<string, any>;`
    }

    const lines: string[] = [`${indent}${key}: {`]
    const innerIndent = `${indent}  `
    const entries = Array.from(props.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    for (const [propName, type] of entries) {
      const formattedProp = formatPropertyKey(propName)
      lines.push(`${innerIndent}readonly ${formattedProp}?: ${type};`)
    }
    lines.push(`${indent}};`)
    return lines.join('\n')
  }

  function createTypedComponentsDefinition() {
    const entries = Array.from(componentPropsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))

    const lines: string[] = [
      '// Auto-generated by weapp-vite. Do not edit.',
      'declare module \'weapp-vite/typed-components\' {',
      '  export interface ComponentProps {',
    ]

    if (entries.length === 0) {
      lines.push('    [component: string]: Record<string, any>;')
    }
    else {
      for (const [name, props] of entries) {
        lines.push(formatComponentEntry(name, props))
      }
      lines.push('    [component: string]: Record<string, any>;')
    }

    lines.push('  }')
    lines.push('  export type ComponentPropName = keyof ComponentProps;')
    lines.push('  export type ComponentProp<Name extends ComponentPropName> = ComponentProps[Name];')
    lines.push('  export const componentProps: ComponentProps;')
    lines.push('}')
    lines.push('')
    return lines.join('\n')
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

    const nextDefinition = createTypedComponentsDefinition()
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
    resolverComponentNames.clear()
    for (const name of Object.keys(resolverEntries)) {
      resolverComponentNames.add(name)
      if (!componentPropsMap.has(name)) {
        componentPropsMap.set(name, new Map())
      }
    }
    for (const key of Array.from(componentPropsMap.keys())) {
      if (resolverComponentNames.has(key)) {
        continue
      }
      if (registry.has(key)) {
        continue
      }
      componentPropsMap.delete(key)
    }
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

    await fs.outputJson(outputPath, manifest, { spaces: 2 })
  }

  let lastTypedComponentsEnabled = false
  let lastTypedComponentsOutput: string | undefined

  function scheduleTypedComponentsWrite(shouldWrite: boolean) {
    const settings = getTypedComponentsSettings()
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
          const currentSettings = getTypedComponentsSettings()
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
          const outputPath = resolveManifestOutputPath()
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
        componentPropsMap.set(name, new Map())
      }
      else {
        componentPropsMap.delete(name)
      }
    }

    if (!jsEntry || !jsonPath || !templatePath) {
      scheduleManifestWrite(removed)
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      return
    }

    const json = await ctx.jsonService.read(jsonPath)
    if (!json?.component) {
      scheduleManifestWrite(removed)
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      return
    }

    const { componentName, base } = resolvedComponentName(baseName)
    if (!componentName) {
      scheduleManifestWrite(removed)
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      return
    }

    const hasComponent = registry.has(componentName)
    if (hasComponent && base !== 'index') {
      logWarnOnce(`发现 \`${componentName}\` 组件重名! 跳过组件 \`${ctx.configService.relativeCwd(baseName)}\` 的自动引入`)
      scheduleManifestWrite(removed)
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
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

    const typedSettings = getTypedComponentsSettings()
    if (typedSettings.enabled) {
      try {
        const code = await fs.readFile(jsEntry, 'utf8')
        const props = extractComponentProps(code)
        componentPropsMap.set(componentName, props)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`解析组件 \`${ctx.configService.relativeCwd(jsEntry)}\` 属性失败: ${message}`)
        componentPropsMap.set(componentName, new Map())
      }
    }
    else {
      componentPropsMap.delete(componentName)
    }

    scheduleTypedComponentsWrite(typedSettings.enabled || removed || removedNames.length > 0)
  }

  function ensureMatcher() {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before filtering components')
    }
    const globs = getAutoImportConfig(ctx.configService)?.globs
    if (!globs || globs.length === 0) {
      autoImportState.matcher = undefined
      autoImportState.matcherKey = ''
      return undefined
    }

    const nextKey = globs.join('\0')
    if (!autoImportState.matcher || autoImportState.matcherKey !== nextKey) {
      autoImportState.matcher = pm(globs, {
        cwd: ctx.configService.cwd,
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
      const value = resolver(componentName, importerBaseName ?? '')
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
      componentPropsMap.clear()
      resolverComponentNames.clear()
      const typedSettings = getTypedComponentsSettings()
      if (typedSettings.enabled) {
        syncResolverComponentProps()
      }
      scheduleTypedComponentsWrite(true)
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
          componentPropsMap.set(name, new Map())
        }
        else {
          componentPropsMap.delete(name)
        }
      }
      scheduleTypedComponentsWrite(removed || removedNames.length > 0)
    },

    resolve(componentName: string, importerBaseName?: string) {
      const local = registry.get(componentName)
      if (local) {
        return local
      }

      const resolved = resolveWithResolvers(componentName, importerBaseName)
      if (resolved) {
        const typedSettings = getTypedComponentsSettings()
        if (typedSettings.enabled) {
          if (!componentPropsMap.has(resolved.value.name)) {
            componentPropsMap.set(resolved.value.name, new Map())
            scheduleTypedComponentsWrite(true)
          }
        }
        else {
          componentPropsMap.delete(resolved.value.name)
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
      ]).then(() => {})
    },
  }
}

export function createAutoImportServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createAutoImportService(ctx)
  ctx.autoImportService = service

  return {
    name: 'weapp-runtime:auto-import-service',
  }
}
