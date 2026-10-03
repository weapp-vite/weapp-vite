import type { EmittedAsset } from 'rolldown'
import type { PackageBuildOutput } from '../../runtime/npmPlugin/builder/output'
import { Buffer } from 'node:buffer'
import { readdir, readFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { captureWatchDependencies } from '../../utils/watchDependencies'
import { relocateNpmSourcemap } from './sourcemap'

export interface PreparedNpmOutput {
  assets: EmittedAsset[]
  external: Map<string, EmittedAsset[]>
  watchFiles: string[]
}

export function relativeOutput(root: string, target: string) {
  const relative = path.relative(root, target)
  return relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative) ? relative : undefined
}

/** 依赖回调只决定逻辑路径，bundle 保持内存，原生包复制只进入本会话的临时目录。 */
export function createNpmOutput(temporaryRoot: string, targetRoots: string[]) {
  const directories = new Map<string, string>()
  const roots = new Set(targetRoots)
  const files = new Map<string, string | Uint8Array>()
  const watchFiles = new Set<string>()
  function addFile(fileName: string, source: string | Uint8Array) {
    const existing = files.get(fileName)
    if (existing !== undefined && !Buffer.from(existing).equals(Buffer.from(source))) {
      throw new Error(`[weapp-vite] 多个 npm 依赖产生了不同内容的同名文件：${fileName}`)
    }
    files.set(fileName, source)
  }
  const output: PackageBuildOutput = {
    watchFile(fileName) {
      watchFiles.add(fileName)
    },
    directory(outDir) {
      roots.add(outDir)
      const parent = [...directories.keys()]
        .filter(root => relativeOutput(root, outDir) !== undefined)
        .sort((a, b) => b.length - a.length)[0]
      if (parent) {
        return path.join(directories.get(parent)!, relativeOutput(parent, outDir)!)
      }
      const directory = path.join(temporaryRoot, String(directories.size))
      directories.set(outDir, directory)
      return directory
    },
    async bundle(options, outDir) {
      roots.add(outDir)
      const result = await build({
        ...options,
        build: { ...options.build, write: false, watch: null },
        plugins: [...options.plugins ?? [], captureWatchDependencies(file => watchFiles.add(file)), {
          name: 'weapp-vite:npm-inputs',
          configResolved(config) {
            for (const file of config.configFileDependencies) {
              watchFiles.add(file)
            }
          },
          buildEnd() {
            for (const file of this.getModuleIds()) {
              if (!file.includes('\0')) {
                watchFiles.add(file.split('?')[0])
              }
            }
          },
        }],
      })
      for (const bundle of Array.isArray(result) ? result : [result]) {
        if (!('output' in bundle)) {
          throw new Error('[weapp-vite] npm 子构建必须返回内存产物。')
        }
        for (const item of bundle.output) {
          addFile(path.resolve(outDir, item.fileName), item.type === 'chunk' ? item.code : item.source)
        }
      }
    },
  }
  // 先登记每个依赖根，保持原生包之间的相对路径和平台 hoist 语义。
  for (const root of targetRoots) {
    output.directory(root)
  }

  async function collect(directory: string, logicalRoot: string) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }
      throw error
    }
    for (const entry of entries) {
      const source = path.join(directory, entry.name)
      const destination = path.join(logicalRoot, entry.name)
      if (entry.isDirectory()) {
        await collect(source, destination)
      }
      else if (entry.isFile()) {
        addFile(destination, await readFile(source))
      }
      else {
        throw new Error(`[weapp-vite] npm 中间目录含有无法发布的文件类型：${destination}`)
      }
    }
  }

  return {
    output,
    async finish(hostOutDir: string, mainOutDir: string, mirrors: string[]): Promise<PreparedNpmOutput> {
      for (const [logicalRoot, directory] of directories) {
        await collect(directory, logicalRoot)
      }
      const mainFiles = [...files].filter(([fileName]) => relativeOutput(mainOutDir, fileName) !== undefined)
      for (const mirror of mirrors) {
        roots.add(mirror)
        for (const [fileName, source] of mainFiles) {
          const mirroredFile = path.join(mirror, relativeOutput(mainOutDir, fileName)!)
          addFile(mirroredFile, relocateNpmSourcemap(source, fileName, mirroredFile))
        }
      }
      const result: PreparedNpmOutput = { assets: [], external: new Map(), watchFiles: [...watchFiles] }
      for (const [absolutePath, source] of files) {
        const relative = relativeOutput(hostOutDir, absolutePath)
        if (relative !== undefined) {
          result.assets.push({ type: 'asset', fileName: relative, source })
          continue
        }
        const directory = [...roots]
          .filter(root => relativeOutput(root, absolutePath) !== undefined)
          .sort((a, b) => a.length - b.length)[0]!
        const assets = result.external.get(directory) ?? []
        assets.push({ type: 'asset', fileName: relativeOutput(directory, absolutePath)!, source })
        result.external.set(directory, assets)
      }
      return result
    },
  }
}
