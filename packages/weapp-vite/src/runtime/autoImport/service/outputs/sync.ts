import type { MutableCompilerContext } from '../../../../context'
import type { HtmlCustomDataSettings, TypedComponentsSettings, VueComponentsSettings } from '../../config'
import type { ComponentMetadata } from '../../metadata'
import type { OutputsState } from './state'
import fs from 'fs-extra'
import path from 'pathe'
import { logger } from '../../../../context/shared'
import {
  getTypedComponentsSettings,
} from '../../config'
import { createHtmlCustomDataDefinition } from '../../htmlCustomData'
import { createTypedComponentsDefinition } from '../../typedDefinition'
import { createVueComponentsDefinition } from '../../vueDefinition'
import { loadWeappBuiltinHtmlTags } from '../../weappBuiltinHtmlTags'
import { collectAllComponentNames } from './manifest'

export interface CommonSyncOptions {
  ctx: MutableCompilerContext
  outputsState: OutputsState
  collectResolverComponents: () => Record<string, string>
  registry: Map<string, any>
  componentMetadataMap: Map<string, ComponentMetadata>
  manifestCache: Map<string, string>
  syncResolverComponentProps: () => void
  preloadResolverComponentMetadata: () => void
  getComponentMetadata: (name: string) => ComponentMetadata
}

const TS_LIKE_EXT_RE = /\.[mc]?[jt]sx?$/
const VUE_LIKE_EXTENSIONS = ['.vue', '.tsx', '.jsx'] as const
const CAMEL_TO_KEBAB_RE = /([a-z0-9])([A-Z])/g
const TRAILING_INDEX_SEGMENT_RE = /\/index$/

function toRelativeImportSpecifier(outputPath: string, sourcePath: string) {
  const relative = path.relative(path.dirname(outputPath), sourcePath).replaceAll('\\', '/')
  if (!relative || relative === '.') {
    return './'
  }
  return relative.startsWith('.') ? relative : `./${relative}`
}

function normalizeLocalNavigationSource(sourcePath: string) {
  if (sourcePath.endsWith('.vue')) {
    return sourcePath
  }
  return sourcePath.replace(TS_LIKE_EXT_RE, '')
}

async function collectLayoutNames(srcRoot: string) {
  const layoutsRoot = path.join(srcRoot, 'layouts')
  const names = new Set<string>()

  async function walk(dir: string) {
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    }
    catch {
      return
    }

    for (const entry of entries) {
      const full = path.join(dir, entry)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        await walk(full)
        continue
      }

      const ext = path.extname(full)
      if (!VUE_LIKE_EXTENSIONS.includes(ext as '.vue' | '.tsx' | '.jsx') && ext !== '.wxml') {
        continue
      }

      const base = ext === '.wxml' ? full.slice(0, -ext.length) : full
      const relativePath = path.relative(layoutsRoot, base)
      const withoutExt = ext === '.wxml'
        ? relativePath
        : relativePath.slice(0, -path.extname(relativePath).length)
      const normalized = withoutExt.replaceAll('\\', '/').replace(TRAILING_INDEX_SEGMENT_RE, '')
      if (!normalized) {
        continue
      }
      const layoutName = normalized
        .split('/')
        .filter(Boolean)
        .map(segment => segment.replace(CAMEL_TO_KEBAB_RE, '$1-$2').replaceAll('_', '-').toLowerCase())
        .join('-')
      if (layoutName) {
        names.add(layoutName)
      }
    }
  }

  await walk(layoutsRoot)
  return [...names].sort((a, b) => a.localeCompare(b))
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
  const outputPath = settings.outputPath

  const componentNames = collectAllComponentNames(options)
  const nextDefinition = createVueComponentsDefinition(componentNames, options.getComponentMetadata, {
    useTypedComponents: getTypedComponentsSettings(ctx).enabled,
    moduleName: settings.moduleName,
    layoutNames: await collectLayoutNames(ctx.configService.absoluteSrcRoot),
    resolveComponentImport: (name) => {
      const local = options.registry.get(name)
      if (local?.kind === 'local') {
        const sourcePath = local.entry?.path || local.entry?.jsonPath || local.entry?.templatePath
        if (sourcePath) {
          return toRelativeImportSpecifier(
            outputPath,
            normalizeLocalNavigationSource(sourcePath),
          )
        }
      }

      const from = resolverComponentsMapRef.value[name]
      if (!from) {
        return undefined
      }
      return resolveNavigationImport(from)
    },
  })
  if (nextDefinition === outputsState.lastWrittenVueComponentsDefinition && outputPath === outputsState.lastVueComponentsOutputPath) {
    return
  }

  try {
    if (outputsState.lastVueComponentsOutputPath && outputsState.lastVueComponentsOutputPath !== outputPath) {
      try {
        await fs.remove(outputsState.lastVueComponentsOutputPath)
      }
      catch { }
    }
    await fs.outputFile(outputPath, nextDefinition, 'utf8')
    outputsState.lastWrittenVueComponentsDefinition = nextDefinition
    outputsState.lastVueComponentsOutputPath = outputPath
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
