import type { MutableCompilerContext } from '../../../context'
import type { HtmlCustomDataSettings, TypedComponentsSettings, VueComponentsSettings } from '../config'
import type { ComponentMetadata } from '../metadata'
import type { OutputsState } from './state'
import fs from 'fs-extra'
import { logger } from '../../../context/shared'
import {
  getTypedComponentsSettings,
} from '../config'
import { createHtmlCustomDataDefinition } from '../htmlCustomData'
import { createTypedComponentsDefinition } from '../typedDefinition'
import { createVueComponentsDefinition } from '../vueDefinition'
import { loadWeappBuiltinHtmlTags } from '../weappBuiltinHtmlTags'
import { collectAllComponentNames } from './manifest'

export interface CommonSyncOptions {
  ctx: MutableCompilerContext
  outputsState: OutputsState
  collectResolverComponents: () => Record<string, string>
  registry: Map<string, any>
  componentMetadataMap: Map<string, ComponentMetadata>
  syncResolverComponentProps: () => void
  preloadResolverComponentMetadata: () => void
  getComponentMetadata: (name: string) => ComponentMetadata
}

export async function syncTypedComponentsDefinition(
  settings: TypedComponentsSettings,
  options: CommonSyncOptions,
) {
  const { outputsState } = options
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

  options.syncResolverComponentProps()
  options.preloadResolverComponentMetadata()

  const componentNames = collectAllComponentNames(options)
  const nextDefinition = createTypedComponentsDefinition(componentNames, options.getComponentMetadata)
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

export async function syncVueComponentsDefinition(
  settings: VueComponentsSettings,
  options: CommonSyncOptions & {
    resolverComponentsMapRef: { value: Record<string, string> }
    resolveNavigationImport: (from: string) => string | undefined
  },
) {
  const { outputsState, ctx, resolverComponentsMapRef, resolveNavigationImport } = options
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

  options.syncResolverComponentProps()
  options.preloadResolverComponentMetadata()

  const componentNames = collectAllComponentNames(options)
  const nextDefinition = createVueComponentsDefinition(componentNames, options.getComponentMetadata, {
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

export async function syncHtmlCustomData(
  settings: HtmlCustomDataSettings,
  options: CommonSyncOptions,
) {
  const { outputsState } = options
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

  options.syncResolverComponentProps()
  options.preloadResolverComponentMetadata()

  const componentNames = collectAllComponentNames(options)
  const builtinTags = loadWeappBuiltinHtmlTags()
  const nextDefinition = createHtmlCustomDataDefinition(componentNames, options.getComponentMetadata, builtinTags)
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
