import { realpath, unlink } from 'node:fs/promises'
import path from 'node:path'

/** 成功写出后仅撤销上一轮持有的文件，不清空目录，也不越过输出根内的符号链接。 */
export async function pruneOwnedAssetFiles(outDir: string, fileNames: Iterable<string>): Promise<void> {
  const root = path.resolve(outDir)
  const names = [...fileNames]
  const files = names.map((fileName) => {
    const normalized = fileName.replaceAll('\\', '/')
    const file = path.resolve(root, normalized)
    const relative = path.relative(root, file)
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
      || path.posix.isAbsolute(normalized) || /^[a-z]:/i.test(normalized)) {
      throw new Error(`Invalid owned output asset path: ${fileName}`)
    }
    return file
  })
  if (!files.length) {
    return
  }
  const realRoot = await realpath(root)
  for (const file of files) {
    try {
      const parent = await realpath(path.dirname(file))
      const relative = path.relative(realRoot, parent)
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('Owned output asset parent resolves outside the output directory')
      }
      await unlink(file)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
}
