import type { OutputAsset, OutputBundle } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import type { SubPackageStyleEntry } from '../types'
import fs from 'fs-extra'
import path from 'pathe'
import { changeFileExtension, isJsOrTs } from '../utils'
import { cssCodeCache, processCssWithCache, renderSharedStyleEntry } from './css/shared/preprocessor'
import { collectSharedStyleEntries, injectSharedStyleImports, toPosixPath } from './css/shared/sharedStyles'

export { cssCodeCache }

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

  if (bundleKey.endsWith('.wxss')) {
    const [rawOriginal] = asset.originalFileNames ?? []
    const absOriginal = rawOriginal
      ? toAbsolute(rawOriginal)
      : path.resolve(configService.absoluteSrcRoot, bundleKey)
    const fileName = configService.relativeAbsoluteSrcRoot(absOriginal)

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

  if (!asset.originalFileNames) {
    delete bundle[bundleKey]
    return
  }

  await Promise.all(
    asset.originalFileNames.map(async (originalFileName) => {
      if (!isJsOrTs(originalFileName)) {
        return
      }

      const modulePath = toAbsolute(originalFileName)
      const converted = changeFileExtension(modulePath, configService.outputExtensions.wxss)
      const fileName = configService.relativeAbsoluteSrcRoot(converted)
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
    }),
  )

  delete bundle[bundleKey]
}

async function emitSharedStyleEntries(
  this: any,
  sharedStyles: Map<string, SubPackageStyleEntry[]>,
  emitted: Set<string>,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
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

      const { css: renderedCss, dependencies } = await renderSharedStyleEntry(entry, configService)
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

async function generateBundleSharedCss(
  this: any,
  ctx: CompilerContext,
  configService: CompilerContext['configService'],
  bundle: OutputBundle,
) {
  const sharedStyles = collectSharedStyleEntries(ctx, configService)
  const emitted = new Set<string>()
  const tasks = Object.entries(bundle).map(([bundleKey, asset]) => {
    return handleBundleEntry.call(this, bundle, bundleKey, asset, configService, sharedStyles, emitted)
  })

  await Promise.all(tasks)
  await emitSharedStyleEntries.call(this, sharedStyles, emitted, configService, bundle)
}

export function css(ctx: CompilerContext): Plugin[] {
  const { configService } = ctx
  return [
    {
      name: 'weapp-vite:css',
      enforce: 'pre',
      async generateBundle(_opts, bundle) {
        await generateBundleSharedCss.call(this, ctx, configService, bundle)
      },
    },
  ]
}
