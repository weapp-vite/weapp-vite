import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { SubPackageStyleEntry } from '../types'
import fs from 'fs-extra'
import path from 'pathe'
import { changeFileExtension, isJsOrTs } from '../utils'
import { normalizeViteId } from '../utils/viteId'
import { cssCodeCache, processCssWithCache, renderSharedStyleEntry } from './css/shared/preprocessor'
import { collectSharedStyleEntries, injectSharedStyleImports, toPosixPath } from './css/shared/sharedStyles'

export { cssCodeCache }

interface ViteMetadata {
  importedCss?: Set<string>
}

type OutputChunkWithViteMetadata = OutputChunk & {
  viteMetadata?: ViteMetadata
}

async function handleBundleEntry(
  this: any,
  bundle: OutputBundle,
  bundleKey: string,
  asset: OutputAsset | OutputBundle[string],
  configService: CompilerContext['configService'],
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  emitted: Set<string>,
) {
  if (asset.type !== 'asset') {
    return
  }

  const toAbsolute = (id: string) => {
    return path.isAbsolute(id) ? id : path.resolve(configService.cwd, id)
  }

  const normalizeOwnerId = (id: string) => {
    return normalizeViteId(id, {
      stripVueVirtualPrefix: true,
      stripLeadingNullByte: true,
    })
  }

  const collectCssOwnersFromChunks = () => {
    const owners = new Set<string>()
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') {
        continue
      }
      const importedCss = (output as OutputChunkWithViteMetadata).viteMetadata?.importedCss
      if (!importedCss || importedCss.size === 0) {
        continue
      }
      if (importedCss.has(bundleKey) && output.facadeModuleId) {
        owners.add(output.facadeModuleId)
      }
    }
    return owners
  }

  if (bundleKey.endsWith('.wxss')) {
    const [rawOriginal] = asset.originalFileNames ?? []
    const absOriginal = rawOriginal
      ? toAbsolute(rawOriginal)
      : path.resolve(configService.absoluteSrcRoot, bundleKey)
    const fileName = configService.relativeOutputPath(absOriginal)

    if (fileName) {
      emitted.add(toPosixPath(fileName))
    }

    if (fileName && fileName !== bundleKey) {
      delete bundle[bundleKey]
      const css = await fs.readFile(absOriginal, 'utf8')
      this.emitFile({
        type: 'asset',
        fileName,
        source: css,
      })
    }

    return
  }

  if (!bundleKey.endsWith('.css')) {
    return
  }

  const ownersFromChunks = collectCssOwnersFromChunks()
  const owners = ownersFromChunks.size
    ? ownersFromChunks
    : new Set(
        (asset.originalFileNames ?? [])
          .map(normalizeOwnerId)
          .filter((originalFileName) => {
            return isJsOrTs(originalFileName) || originalFileName.endsWith('.vue')
          })
          .map(toAbsolute),
      )

  if (!owners.size) {
    delete bundle[bundleKey]
    return
  }

  await Promise.all(Array.from(owners).map(async (owner) => {
    const modulePath = owner
    const converted = changeFileExtension(modulePath, configService.outputExtensions.wxss)
    const fileName = configService.relativeOutputPath(converted)
    if (!fileName) {
      return
    }
    const normalizedFileName = toPosixPath(fileName)
    const rawCss = asset.source.toString()
    const processedCss = await processCssWithCache(rawCss, configService)

    const cssWithImports = injectSharedStyleImports(
      processedCss,
      modulePath,
      fileName,
      sharedStyles,
      configService,
    )

    this.emitFile({
      type: 'asset',
      fileName,
      source: cssWithImports,
    })
    emitted.add(normalizedFileName)
  }))

  delete bundle[bundleKey]
}

async function emitSharedStyleEntries(
  this: any,
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  emitted: Set<string>,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
  resolvedConfig?: ResolvedConfig,
) {
  if (!sharedStyles.size) {
    return
  }

  for (const entries of sharedStyles.values()) {
    for (const entry of entries) {
      const fileName = toPosixPath(entry.outputRelativePath)
      if (emitted.has(fileName)) {
        continue
      }

      const absolutePath = entry.absolutePath
      if (typeof this.addWatchFile === 'function') {
        this.addWatchFile(absolutePath)
      }

      if (!await fs.pathExists(absolutePath)) {
        continue
      }

      const { css: renderedCss, dependencies } = await renderSharedStyleEntry(entry, configService, resolvedConfig)
      if (typeof this.addWatchFile === 'function' && dependencies.length) {
        for (const dependency of dependencies) {
          if (dependency && dependency !== absolutePath) {
            this.addWatchFile(dependency)
          }
        }
      }

      const css = await processCssWithCache(renderedCss, configService)

      emitted.add(fileName)
      if (bundle[fileName]) {
        delete bundle[fileName]
      }

      this.emitFile({
        type: 'asset',
        fileName,
        source: css,
      })
    }
  }
}

async function emitSharedStyleImportsForChunks(
  this: any,
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  emitted: Set<string>,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
) {
  if (!sharedStyles.size) {
    return
  }

  const { outputExtensions } = configService

  await Promise.all(
    Object.values(bundle).map(async (output) => {
      if (output.type !== 'chunk') {
        return
      }

      const moduleId = output.facadeModuleId
      if (!moduleId) {
        return
      }

      const relativeModulePath = configService.relativeAbsoluteSrcRoot(moduleId)
      if (!relativeModulePath) {
        return
      }

      const converted = changeFileExtension(moduleId, outputExtensions.wxss)
      const fileName = configService.relativeOutputPath(converted)
      if (!fileName) {
        return
      }

      const normalizedFileName = toPosixPath(fileName)
      if (emitted.has(normalizedFileName)) {
        return
      }

      const cssWithImports = injectSharedStyleImports(
        '',
        moduleId,
        fileName,
        sharedStyles,
        configService,
      )

      if (!cssWithImports.trim()) {
        return
      }

      const processedCss = await processCssWithCache(cssWithImports, configService)

      this.emitFile({
        type: 'asset',
        fileName,
        source: processedCss,
      })

      emitted.add(normalizedFileName)
    }),
  )
}

async function generateBundleSharedCss(
  this: any,
  ctx: CompilerContext,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
  resolvedConfig?: ResolvedConfig,
) {
  const sharedStyles = collectSharedStyleEntries(ctx, configService)
  const emitted = new Set<string>()
  const tasks = Object.entries(bundle).map(([bundleKey, asset]) => {
    return handleBundleEntry.call(this, bundle, bundleKey, asset, configService, sharedStyles, emitted)
  })

  await Promise.all(tasks)
  await emitSharedStyleEntries.call(this, sharedStyles, emitted, configService, bundle, resolvedConfig)
  await emitSharedStyleImportsForChunks.call(this, sharedStyles, emitted, configService, bundle)
}

export function css(ctx: CompilerContext): Plugin[] {
  const { configService } = ctx
  let resolvedConfig: ResolvedConfig | undefined
  return [
    {
      name: 'weapp-vite:css',
      enforce: 'pre',
      configResolved(config) {
        resolvedConfig = config
      },
      async generateBundle(_opts, bundle) {
        await generateBundleSharedCss.call(this, ctx, configService, bundle, resolvedConfig)
      },
    },
  ]
}
