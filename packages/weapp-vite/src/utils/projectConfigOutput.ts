import type { OutputAsset } from 'rolldown'
import { readdir, readFile, realpath } from 'node:fs/promises'
import path from 'pathe'
import { pruneOwnedAssetFiles } from '../plugins/asset/prune'
import { loadHostRolldownBuild } from '../runtime/viteHost/engine'

/** 已枚举的子项可能被监听中的删除操作撤销，根目录和其他读取错误仍须报告。 */
async function readCollectedPath<T>(read: () => Promise<T>, required: boolean): Promise<T | undefined> {
  try {
    return await read()
  }
  catch (error) {
    if (!required && error !== null && typeof error === 'object' && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return undefined
    }
    throw error
  }
}

/** 平台项目目录独立发布，禁止覆盖由主编译持有的小程序目录。 */
export async function collectProjectConfigAssets(sourceDir: string, outputRoot: string, outDir: string, watch?: (file: string) => void) {
  const assets: Array<Pick<OutputAsset, 'fileName' | 'source'>> = []
  async function visit(dir: string, required = false) {
    if (watch) {
      const watched = await readCollectedPath(() => realpath(dir), required)
      if (watched === undefined) {
        return
      }
      watch(path.normalize(watched))
    }
    const entries = await readCollectedPath(() => readdir(dir, { withFileTypes: true }), required)
    if (entries === undefined) {
      return
    }
    for (const entry of entries) {
      const file = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) {
        throw new Error(`[weapp-vite] 平台项目配置目录不支持符号链接：${path.relative(sourceDir, file)}`)
      }
      const fileName = path.relative(sourceDir, file)
      const target = path.resolve(outputRoot, fileName)
      const relative = path.relative(path.resolve(outDir), target)
      if (!relative || (!relative.startsWith('../') && relative !== '..' && !path.isAbsolute(relative))) {
        throw new Error(`[weapp-vite] 平台项目配置不能覆盖小程序输出：${fileName}`)
      }
      if (entry.isDirectory()) {
        await visit(file)
      }
      else if (entry.isFile()) {
        if (watch) {
          const watched = await readCollectedPath(() => realpath(file), false)
          if (watched === undefined) {
            continue
          }
          watch(path.normalize(watched))
        }
        const source = await readCollectedPath(() => readFile(file), false)
        if (source !== undefined) {
          assets.push({ fileName, source })
        }
      }
    }
  }
  await visit(sourceDir, true)
  return assets
}

/** 使用宿主配套引擎写出平台配置，写入失败时不删除上一轮文件。 */
export async function publishProjectConfigAssets(outputRoot: string, assets: Array<Pick<OutputAsset, 'fileName' | 'source'>>, previous: ReadonlySet<string> = new Set()) {
  const entry = '\0weapp-vite-project-config-output'
  const { rolldown } = await loadHostRolldownBuild()
  const bundle = await rolldown({
    input: entry,
    logLevel: 'silent',
    plugins: [{
      name: 'weapp-vite:project-config-writer',
      resolveId: id => id === entry ? entry : undefined,
      load: id => id === entry ? 'export {}' : undefined,
      generateBundle(_options, output) {
        for (const [name, item] of Object.entries(output)) {
          if (item.type === 'chunk' && item.facadeModuleId === entry) {
            delete output[name]
          }
        }
        for (const asset of assets) {
          this.emitFile({ type: 'asset', ...asset })
        }
      },
    }],
  })
  const current = new Set(assets.map(asset => asset.fileName))
  try {
    await bundle.write({ dir: outputRoot, format: 'es' })
    await pruneOwnedAssetFiles(outputRoot, [...previous].filter(file => !current.has(file)))
  }
  finally {
    await bundle.close()
  }
  return current
}
