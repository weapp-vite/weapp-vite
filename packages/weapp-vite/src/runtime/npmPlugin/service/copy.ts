import { copyFile } from 'node:fs/promises'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'

/** 无自定义构建回调时复用共享 npm 产物，只复制当前分包声明的依赖闭包。 */
export async function copyDirectoryWithFilter(
  sourceDir: string,
  targetDir: string,
  filter: (sourcePath: string) => boolean,
) {
  await fs.ensureDir(targetDir)
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  await Promise.all(entries.map(async (entry) => {
    const sourcePath = path.resolve(sourceDir, entry.name)
    if (!filter(sourcePath)) {
      return
    }

    const targetPath = path.resolve(targetDir, entry.name)
    if (entry.isDirectory()) {
      await copyDirectoryWithFilter(sourcePath, targetPath, filter)
      return
    }

    await fs.ensureDir(path.dirname(targetPath))
    await copyFile(sourcePath, targetPath)
  }))
}
