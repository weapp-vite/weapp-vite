import type { EmittedAsset, Plugin } from 'rolldown'
import { pruneOwnedAssetFiles } from '../../plugins/asset/prune'
import { loadHostRolldownBuild } from '../../runtime/viteHost/engine'

/** 手工映射到主目录外的依赖仍由宿主配套引擎写出，只清理上轮实际拥有的文件。 */
export async function publishNpmAssets(outDir: string, assets: EmittedAsset[], obsolete: string[]) {
  const virtualEntry = '\0weapp-vite-npm-output'
  const plugin: Plugin = {
    name: 'weapp-vite:npm-output-writer',
    resolveId: id => id === virtualEntry ? id : undefined,
    load: id => id === virtualEntry ? 'export {}' : undefined,
    buildStart() {
      for (const asset of assets) {
        this.emitFile(asset)
      }
    },
    generateBundle(_options, bundle) {
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.facadeModuleId === virtualEntry) {
          delete bundle[fileName]
        }
      }
    },
    async writeBundle() {
      await pruneOwnedAssetFiles(outDir, obsolete)
    },
  }
  const { rolldown } = await loadHostRolldownBuild()
  const bundle = await rolldown({ input: virtualEntry, logLevel: 'silent', plugins: [plugin] })
  try {
    await bundle.write({ dir: outDir, format: 'es' })
  }
  finally {
    await bundle.close()
  }
}
