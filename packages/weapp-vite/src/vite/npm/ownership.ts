import type { EmittedAsset } from 'rolldown'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'pathe'
import { publishNpmAssets } from './publish'

async function readOwnership(fileName: string) {
  let value: unknown
  try {
    value = JSON.parse(await readFile(fileName, 'utf8'))
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Map<string, string[]>()
    }
    throw error
  }
  if (!Array.isArray(value) || !value.every(entry => Array.isArray(entry) && entry.length === 2
    && typeof entry[0] === 'string' && Array.isArray(entry[1]) && entry[1].every(file => typeof file === 'string'))) {
    throw new Error('[weapp-vite] npm 输出归属记录损坏，请移除 .weapp-vite/native-npm-output 后重建。')
  }
  return new Map(value as [string, string[]][])
}

/** 保存外部产物的实际归属，使独立 build 也能删除旧依赖而保留非构建文件。 */
export async function publishOwnedNpmAssets(cwd: string, hostOutDir: string, external: Map<string, EmittedAsset[]>) {
  const key = createHash('sha256').update(hostOutDir).digest('hex').slice(0, 20)
  const metadataRoot = path.join(cwd, '.weapp-vite/native-npm-output')
  const metadataName = `${key}.json`
  const previous = await readOwnership(path.join(metadataRoot, metadataName))
  const current = new Map<string, string[]>()
  const currentFiles = new Set<string>()
  for (const [directory, assets] of external) {
    if (assets.length) {
      const names = assets.map(asset => asset.fileName!)
      current.set(directory, names)
      for (const file of names) {
        currentFiles.add(path.resolve(directory, file))
      }
    }
  }
  for (const directory of new Set([...external.keys(), ...previous.keys()])) {
    const assets = external.get(directory) ?? []
    // 映射根可以跨轮迁移；文件只要仍由本轮任一根拥有，就不能被旧根清理。
    const obsolete = (previous.get(directory) ?? []).filter(file => !currentFiles.has(path.resolve(directory, file)))
    await publishNpmAssets(directory, assets, obsolete)
  }
  // 元信息同样由原生 emit/write 发布；外部目录全部成功后再推进归属记录。
  if (current.size || previous.size) {
    await publishNpmAssets(metadataRoot, [{ type: 'asset', fileName: metadataName, source: JSON.stringify([...current]) }], [])
  }
}
