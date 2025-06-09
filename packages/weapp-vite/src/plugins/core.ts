import type { ChangeEvent, RollupOutput, RollupWatcher } from 'rollup'
import type { Plugin } from 'vite'
import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue } from '@/types'
import { isEmptyObject, isObject, removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'vite'
import logger from '@/logger'
import { getCssRealPath, parseRequest } from '@/plugins/utils/parse'
import { isCSSRequest } from '@/utils'
import { changeFileExtension, isJsOrTs } from '@/utils/file'
import { handleWxml } from '@/wxml/handle'
import { useLoadEntry } from './hooks/useLoadEntry'
import { collectRequireTokens } from './utils/ast'

// const debouncedLoggerSuccess = debounce((message: string) => {
//   return logger.success(message)
// }, 25)

export function weappVite(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin[] {
  const { scanService, configService, jsonService, wxmlService, buildService, watcherService } = ctx
  const { loadEntry, jsonEmitFilesMap, loadedEntrySet } = useLoadEntry(ctx)
  const requireAsyncEmittedChunks = new Set<string>()
  // const watchChangeQueue = new PQueue()

  let pq: Promise<{
    meta: SubPackageMetaValue
    rollup: RollupOutput | RollupOutput[] | RollupWatcher
  }>[] = []//

  return [
    {
      name: 'weapp-vite:pre',
      enforce: 'pre',
      buildStart() {
        loadedEntrySet.clear()
      },
      // https://github.com/rollup/rollup/blob/1f2d579ccd4b39f223fed14ac7d031a6c848cd80/src/Graph.ts#L97
      watchChange(id: string, change: { event: ChangeEvent }) {
        if (subPackageMeta) {
          logger.success(`[${change.event}] ${configService.relativeCwd(id)} --[独立分包 ${subPackageMeta.subPackage.root}]`)
        }
        else {
          logger.success(`[${change.event}] ${configService.relativeCwd(id)}`)
        }
      },

      async options(options) {
        let scanedInput: Record<string, string>
        if (subPackageMeta) {
          scanedInput = subPackageMeta.entries.reduce<Record<string, string>>((acc, cur) => {
            acc[cur] = path.resolve(configService.absoluteSrcRoot, cur)
            return acc
          }, {})
        }
        else {
          // scanService.resetEntries()
          const appEntry = await scanService.loadAppEntry()
          pq = scanService.loadIndependentSubPackage().map(async (x) => {
            return {
              meta: x,
              rollup: await build(
                configService.merge(x, {
                  build: {
                    write: false,
                    rollupOptions: {
                      output: {
                        chunkFileNames() {
                          return `${x.subPackage.root}/[name]-[hash].js`
                        },
                      },
                    },
                  },
                }),
              ),
            }
          })
          buildService.queue.start()
          scanedInput = {
            app: appEntry.path,
          }
        }
        options.input = scanedInput// defu(options.input, scanedInput)
      },
      resolveId(id) {
        configService.weappViteConfig?.debug?.resolveId?.(id, subPackageMeta)
        if (id.endsWith('.wxss')) {
          return id.replace(/\.wxss$/, '.css?wxss')
        }
      },
      // 触发时机
      // https://github.com/rollup/rollup/blob/328fa2d18285185a20bf9b6fde646c3c28f284ae/src/ModuleLoader.ts#L284
      // 假如返回的是 null, 这时候才会往下添加到 this.graph.watchFiles
      // https://github.com/rollup/rollup/blob/328fa2d18285185a20bf9b6fde646c3c28f284ae/src/utils/PluginDriver.ts#L153
      async load(id) {
        configService.weappViteConfig?.debug?.load?.(id, subPackageMeta)
        const relativeBasename = removeExtensionDeep(
          configService
            .relativeAbsoluteSrcRoot(id),
        )
        if (isCSSRequest(id)) {
          const parsed = parseRequest(id)

          if (parsed.query.wxss) {
            const realPath = getCssRealPath(parsed)
            this.addWatchFile(realPath)
            if (await fs.exists(realPath)) {
              const css = await fs.readFile(realPath, 'utf8')
              return {
                code: css,
              }
            }
          }
          return null
        }
        else if (loadedEntrySet.has(id) || subPackageMeta?.entries.includes(relativeBasename)) {
          return await loadEntry.call(this, id, 'component')
        }
        else if ([
          'app',
        ].includes(
          relativeBasename,
        )) {
          // isApp
          return await loadEntry.call(this, id, 'app')
        }
      },
      // shouldTransformCachedModule() {
      //   return true
      // },
      renderStart() {
        for (const jsonEmitFile of jsonEmitFilesMap.values()) {
          if (jsonEmitFile.entry.json
            && isObject(jsonEmitFile.entry.json)
            && !isEmptyObject(jsonEmitFile.entry.json)) {
            this.emitFile(
              {
                type: 'asset',
                fileName: jsonEmitFile.fileName,
                source: jsonService.resolve(jsonEmitFile.entry),
              },
            )
          }
        }

        const currentPackageWxmls = Array.from(
          wxmlService.tokenMap.entries(),
        )
          .map(([id, token]) => {
            return {
              id,
              token,
              fileName: configService.relativeAbsoluteSrcRoot(id),
            }
          })
          .filter(({ fileName }) => {
            if (subPackageMeta) {
              return fileName.startsWith(subPackageMeta.subPackage.root)
            }
            else {
              return scanService.isMainPackageFileName(fileName)
            }
          })

        for (const { fileName, token } of currentPackageWxmls) {
          const result = handleWxml(token)

          this.emitFile(
            {
              type: 'asset',
              fileName, // templateEmitFile.fileName,
              source: result.code,
            },
          )
        }
      },
      async generateBundle(_options, bundle) {
        if (!subPackageMeta) {
          const res = (await Promise.all(pq))

          const chunks = res.reduce<RollupOutput[]>((acc, { meta, rollup }) => {
            const chunk = Array.isArray(rollup) ? rollup[0] : rollup
            if ('output' in chunk) {
              acc.push(chunk)
              return acc
            }
            else {
              // 这里其实就返回的是RollupWatcher了
              watcherService.setRollupWatcher(chunk, meta.subPackage.root)
            }
            return acc
          }, [])
          for (const chunk of chunks) {
            for (const output of chunk.output) {
              bundle[output.fileName] = output
            }
          }
        }
        if (configService.weappViteConfig?.debug?.watchFiles && typeof this.getWatchFiles === 'function') {
          const watchFiles = this.getWatchFiles()
          configService.weappViteConfig.debug.watchFiles(watchFiles, subPackageMeta)
        }
      },
      // closeBundle() {
      //   if (configService.weappViteConfig?.debug?.watchFiles) {
      //     const watchFiles = this.getWatchFiles()
      //     configService.weappViteConfig.debug.watchFiles(watchFiles, subPackageMeta)
      //   }
      // },
      buildEnd() {
        logger.success(`${subPackageMeta ? '独立分包' : '主包'} ${Array.from(this.getModuleIds()).length} 个模块被编译`)
      },
    },
    {
      name: 'weapp-vite:post',
      enforce: 'post',
      async transform(code, id) {
        if (isJsOrTs(id)) {
          try {
            const ast = this.parse(code)

            const { requireModules } = collectRequireTokens(ast)

            for (const requireModule of requireModules) {
              const absPath = path.resolve(path.dirname(id), requireModule.value)
              const resolveId = await this.resolve(absPath, id)
              if (resolveId) {
                await this.load(resolveId)
                if (!requireAsyncEmittedChunks.has(resolveId.id)) {
                  requireAsyncEmittedChunks.add(resolveId.id)
                  this.emitFile({
                    type: 'chunk',
                    id: resolveId.id,
                    fileName: configService.relativeAbsoluteSrcRoot(
                      changeFileExtension(resolveId.id, '.js'),
                    ),
                    preserveSignature: 'exports-only',
                  })
                }
              }
            }
            return {
              code,
              ast,
              map: null,
            }
          }
          catch (error) {
            logger.error(error)
          }
        }
      },
      // shouldTransformCachedModule(options) {

      // },
      // generateBundle() {
      //   const infos = [...this.getModuleIds()].map((x) => {
      //     return this.getModuleInfo(x)
      //   })
      //   console.log(infos)
      // },
    },
  ]
}
