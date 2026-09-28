import type { OutputAsset, OutputChunk, Plugin } from 'rolldown'
import path from 'node:path'
import { rolldown } from 'rolldown'
import { build } from 'vite'
import { pruneOwnedAssetFiles } from '../../plugins/asset/prune'

export type StatefulHmrOutputFile = Pick<OutputAsset, 'fileName' | 'source' | 'type'>
  | (Pick<OutputChunk, 'code' | 'fileName' | 'modules' | 'type'> & Partial<Pick<OutputChunk, 'isEntry' | 'imports' | 'map' | 'sourcemapFileName'>>)

export interface StatefulHmrInitialPublicAssets {
  publicDir: string | false
  copyPublicDir: boolean
}

/**
 * @description 通过原生 write 持久化已编译文件；首轮保留 Vite public 复制，增量不重复解析构建配置。
 */
export async function writeStatefulHmrOutput(
  outDir: string,
  output: StatefulHmrOutputFile[],
  initialPublicAssets?: StatefulHmrInitialPublicAssets,
  removedAssets: string[] = [],
): Promise<void> {
  const virtualEntry = '\0weapp-vite-stateful-hmr-output'
  const writerPlugin: Plugin = {
    name: 'weapp-vite:stateful-hmr-output-writer',
    resolveId(id) {
      return id === virtualEntry ? virtualEntry : undefined
    },
    load(id) {
      return id === virtualEntry ? 'export {}' : undefined
    },
    buildStart() {
      for (const item of output) {
        this.emitFile({
          type: 'asset',
          fileName: item.fileName.replaceAll('\\', '/'),
          source: item.type === 'chunk' ? item.code : item.source,
        })
      }
    },
    async writeBundle() {
      const emitted = new Set(output.map(item => item.fileName))
      await pruneOwnedAssetFiles(outDir, removedAssets.filter(file => !emitted.has(file)))
    },
    generateBundle(_options, bundle) {
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.facadeModuleId === virtualEntry) {
          delete bundle[fileName]
        }
      }
    },
  }
  if (!initialPublicAssets) {
    const bundle = await rolldown({
      input: virtualEntry,
      logLevel: 'silent',
      plugins: [writerPlugin],
    })
    try {
      await bundle.write({ dir: outDir, format: 'es', minify: false })
    }
    finally {
      await bundle.close()
    }
    return
  }
  await build({
    configFile: false,
    logLevel: 'silent',
    // 首轮完整发布由 Vite 复制已解析的 public 目录；增量写入不重复覆盖静态资源。
    publicDir: initialPublicAssets?.publicDir || false,
    build: {
      copyPublicDir: initialPublicAssets?.copyPublicDir ?? false,
      emptyOutDir: false,
      minify: false,
      outDir,
      rolldownOptions: {
        input: virtualEntry,
      },
      write: true,
    },
    plugins: [writerPlugin],
    root: path.dirname(outDir),
  })
}
