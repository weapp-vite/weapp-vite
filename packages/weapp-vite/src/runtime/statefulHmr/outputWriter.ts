import type { OutputAsset, OutputChunk } from 'rolldown'
import path from 'node:path'
import { build } from 'vite'

export type StatefulHmrOutputFile = Pick<OutputAsset, 'fileName' | 'source' | 'type'>
  | Pick<OutputChunk, 'code' | 'fileName' | 'modules' | 'type'>

/**
 * @description 通过独立的 Vite write 阶段持久化 DevEngine 已生成的文件，不重新解析业务源码。
 */
export async function writeStatefulHmrOutput(outDir: string, output: StatefulHmrOutputFile[]): Promise<void> {
  const virtualEntry = '\0weapp-vite-stateful-hmr-output'
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      emptyOutDir: false,
      minify: false,
      outDir,
      rolldownOptions: {
        input: virtualEntry,
      },
      write: true,
    },
    plugins: [{
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
      generateBundle(_options, bundle) {
        for (const [fileName, item] of Object.entries(bundle)) {
          if (item.type === 'chunk' && item.facadeModuleId === virtualEntry) {
            delete bundle[fileName]
          }
        }
      },
    }],
    root: path.dirname(outDir),
  })
}
