import type { MutableCompilerContext } from '../../context'
import type { HtmlCustomDataSettings, TypedComponentsSettings, VueComponentsSettings } from './config'
import type { ComponentMetadata } from './metadata'
import type { LocalAutoImportMatch } from './types'
import fs from 'fs-extra'
import { logger } from '../../context/shared'
import {
  getAutoImportConfig,
  getHtmlCustomDataSettings,
  getTypedComponentsSettings,
  getVueComponentsSettings,
  resolveManifestOutputPath,
} from './config'
import { createHtmlCustomDataDefinition } from './htmlCustomData'
import { createTypedComponentsDefinition } from './typedDefinition'
import { createVueComponentsDefinition } from './vueDefinition'
import { loadWeappBuiltinHtmlTags } from './weappBuiltinHtmlTags'

export interface OutputsState {
  pendingWrite?: Promise<void>
  writeRequested: boolean
  pendingTypedWrite?: Promise<void>
  typedWriteRequested: boolean
  lastWrittenTypedDefinition?: string
  lastTypedDefinitionOutputPath?: string
  pendingHtmlCustomDataWrite?: Promise<void>
  htmlCustomDataWriteRequested: boolean
  lastWrittenHtmlCustomData?: string
  lastHtmlCustomDataOutputPath?: string
  pendingVueComponentsWrite?: Promise<void>
  vueComponentsWriteRequested: boolean
  lastWrittenVueComponentsDefinition?: string
  lastVueComponentsOutputPath?: string
  lastHtmlCustomDataEnabled: boolean
  lastHtmlCustomDataOutput?: string
  lastTypedComponentsEnabled: boolean
  lastTypedComponentsOutput?: string
  lastVueComponentsEnabled: boolean
  lastVueComponentsOutput?: string
}

export interface OutputsHelpers {
  scheduleManifestWrite: (shouldWrite: boolean) => void
  scheduleTypedComponentsWrite: (shouldWrite: boolean) => void
  scheduleHtmlCustomDataWrite: (shouldWrite: boolean) => void
  scheduleVueComponentsWrite: (shouldWrite: boolean) => void
}

interface OutputsOptions {
  ctx: MutableCompilerContext
  registry: Map<string, LocalAutoImportMatch>
  manifestFileName: string
  manifestCache: Map<string, string>
  componentMetadataMap: Map<string, ComponentMetadata>
  outputsState: OutputsState
  resolverComponentsMapRef: { value: Record<string, string> }
  collectResolverComponents: () => Record<string, string>
  syncResolverComponentProps: () => void
  preloadResolverComponentMetadata: () => void
  getComponentMetadata: (name: string) => ComponentMetadata
  resolveNavigationImport: (from: string) => string | undefined
}

export function createOutputsHelpers(options: OutputsOptions): OutputsHelpers {
  const {
    ctx,
    registry,
    manifestFileName,
    manifestCache,
    componentMetadataMap,
    outputsState,
    resolverComponentsMapRef,
    collectResolverComponents,
    syncResolverComponentProps,
    preloadResolverComponentMetadata,
    getComponentMetadata,
    resolveNavigationImport,
  } = options

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

  async function syncTypedComponentsDefinition(settings: TypedComponentsSettings) {
    if (!settings.enabled || !settings.outputPath) {
      if (outputsState.lastTypedDefinitionOutputPath) {
        try {
          await fs.remove(outputsState.lastTypedDefinitionOutputPath)
        }
        catch { }
      }
      outputsState.lastTypedDefinitionOutputPath = undefined
      outputsState.lastWrittenTypedDefinition = undefined
      return
    }

    syncResolverComponentProps()
    preloadResolverComponentMetadata()

    const componentNames = collectAllComponentNames()
    const nextDefinition = createTypedComponentsDefinition(componentNames, getComponentMetadata)
    if (nextDefinition === outputsState.lastWrittenTypedDefinition && settings.outputPath === outputsState.lastTypedDefinitionOutputPath) {
      return
    }

    try {
      if (outputsState.lastTypedDefinitionOutputPath && outputsState.lastTypedDefinitionOutputPath !== settings.outputPath) {
        try {
          await fs.remove(outputsState.lastTypedDefinitionOutputPath)
        }
        catch { }
      }
      await fs.outputFile(settings.outputPath, nextDefinition, 'utf8')
      outputsState.lastWrittenTypedDefinition = nextDefinition
      outputsState.lastTypedDefinitionOutputPath = settings.outputPath
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`写入 typed-components.d.ts 失败: ${message}`)
    }
  }

  async function syncVueComponentsDefinition(settings: VueComponentsSettings) {
    if (!settings.enabled || !settings.outputPath) {
      if (outputsState.lastVueComponentsOutputPath) {
        try {
          await fs.remove(outputsState.lastVueComponentsOutputPath)
        }
        catch { }
      }
      outputsState.lastVueComponentsOutputPath = undefined
      outputsState.lastWrittenVueComponentsDefinition = undefined
      return
    }

    syncResolverComponentProps()
    preloadResolverComponentMetadata()

    const componentNames = collectAllComponentNames()
    const nextDefinition = createVueComponentsDefinition(componentNames, getComponentMetadata, {
      useTypedComponents: getTypedComponentsSettings(ctx).enabled,
      moduleName: settings.moduleName,
      resolveComponentImport: (name) => {
        const from = resolverComponentsMapRef.value[name]
        if (!from) {
          return undefined
        }
        return resolveNavigationImport(from)
      },
    })
    if (nextDefinition === outputsState.lastWrittenVueComponentsDefinition && settings.outputPath === outputsState.lastVueComponentsOutputPath) {
      return
    }

    try {
      if (outputsState.lastVueComponentsOutputPath && outputsState.lastVueComponentsOutputPath !== settings.outputPath) {
        try {
          await fs.remove(outputsState.lastVueComponentsOutputPath)
        }
        catch { }
      }
      await fs.outputFile(settings.outputPath, nextDefinition, 'utf8')
      outputsState.lastWrittenVueComponentsDefinition = nextDefinition
      outputsState.lastVueComponentsOutputPath = settings.outputPath
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`写入 components.d.ts 失败: ${message}`)
    }
  }

  async function syncHtmlCustomData(settings: HtmlCustomDataSettings) {
    if (!settings.enabled || !settings.outputPath) {
      if (outputsState.lastHtmlCustomDataOutputPath) {
        try {
          await fs.remove(outputsState.lastHtmlCustomDataOutputPath)
        }
        catch { }
      }
      outputsState.lastHtmlCustomDataOutputPath = undefined
      outputsState.lastWrittenHtmlCustomData = undefined
      return
    }

    syncResolverComponentProps()
    preloadResolverComponentMetadata()

    const componentNames = collectAllComponentNames()
    const builtinTags = loadWeappBuiltinHtmlTags()
    const nextDefinition = createHtmlCustomDataDefinition(componentNames, getComponentMetadata, builtinTags)
    if (nextDefinition === outputsState.lastWrittenHtmlCustomData && settings.outputPath === outputsState.lastHtmlCustomDataOutputPath) {
      return
    }

    try {
      if (outputsState.lastHtmlCustomDataOutputPath && outputsState.lastHtmlCustomDataOutputPath !== settings.outputPath) {
        try {
          await fs.remove(outputsState.lastHtmlCustomDataOutputPath)
        }
        catch { }
      }
      await fs.outputFile(settings.outputPath, nextDefinition, 'utf8')
      outputsState.lastWrittenHtmlCustomData = nextDefinition
      outputsState.lastHtmlCustomDataOutputPath = settings.outputPath
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`写入 mini-program.html-data.json 失败: ${message}`)
    }
  }

  function scheduleHtmlCustomDataWrite(shouldWrite: boolean) {
    const settings = getHtmlCustomDataSettings(ctx)
    const configChanged = settings.enabled !== outputsState.lastHtmlCustomDataEnabled
      || settings.outputPath !== outputsState.lastHtmlCustomDataOutput

    if (!shouldWrite && !configChanged && !outputsState.lastHtmlCustomDataOutputPath) {
      return
    }

    outputsState.htmlCustomDataWriteRequested = true
    if (outputsState.pendingHtmlCustomDataWrite) {
      return
    }

    outputsState.pendingHtmlCustomDataWrite = Promise.resolve()
      .then(async () => {
        while (outputsState.htmlCustomDataWriteRequested) {
          outputsState.htmlCustomDataWriteRequested = false
          const currentSettings = getHtmlCustomDataSettings(ctx)
          await syncHtmlCustomData(currentSettings)
          outputsState.lastHtmlCustomDataEnabled = currentSettings.enabled
          outputsState.lastHtmlCustomDataOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        outputsState.pendingHtmlCustomDataWrite = undefined
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

  function scheduleTypedComponentsWrite(shouldWrite: boolean) {
    const settings = getTypedComponentsSettings(ctx)
    const configChanged = settings.enabled !== outputsState.lastTypedComponentsEnabled
      || settings.outputPath !== outputsState.lastTypedComponentsOutput

    if (!shouldWrite && !configChanged && !outputsState.lastTypedDefinitionOutputPath) {
      return
    }

    outputsState.typedWriteRequested = true
    if (outputsState.pendingTypedWrite) {
      return
    }

    outputsState.pendingTypedWrite = Promise.resolve()
      .then(async () => {
        while (outputsState.typedWriteRequested) {
          outputsState.typedWriteRequested = false
          const currentSettings = getTypedComponentsSettings(ctx)
          await syncTypedComponentsDefinition(currentSettings)
          outputsState.lastTypedComponentsEnabled = currentSettings.enabled
          outputsState.lastTypedComponentsOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        outputsState.pendingTypedWrite = undefined
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

    outputsState.writeRequested = true
    if (outputsState.pendingWrite) {
      return
    }

    outputsState.pendingWrite = Promise.resolve()
      .then(async () => {
        while (outputsState.writeRequested) {
          outputsState.writeRequested = false
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
        outputsState.pendingWrite = undefined
      })
  }

  function scheduleVueComponentsWrite(shouldWrite: boolean) {
    const settings = getVueComponentsSettings(ctx)
    const configChanged = settings.enabled !== outputsState.lastVueComponentsEnabled
      || settings.outputPath !== outputsState.lastVueComponentsOutput

    if (!shouldWrite && !configChanged && !outputsState.lastVueComponentsOutputPath) {
      return
    }

    outputsState.vueComponentsWriteRequested = true
    if (outputsState.pendingVueComponentsWrite) {
      return
    }

    outputsState.pendingVueComponentsWrite = Promise.resolve()
      .then(async () => {
        while (outputsState.vueComponentsWriteRequested) {
          outputsState.vueComponentsWriteRequested = false
          const currentSettings = getVueComponentsSettings(ctx)
          await syncVueComponentsDefinition(currentSettings)
          outputsState.lastVueComponentsEnabled = currentSettings.enabled
          outputsState.lastVueComponentsOutput = currentSettings.outputPath
        }
      })
      .finally(() => {
        outputsState.pendingVueComponentsWrite = undefined
      })
  }

  return {
    scheduleManifestWrite,
    scheduleTypedComponentsWrite,
    scheduleHtmlCustomDataWrite,
    scheduleVueComponentsWrite,
  }
}
