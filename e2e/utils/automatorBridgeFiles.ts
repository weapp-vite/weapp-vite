import fs from 'node:fs'
import path from 'node:path'

export function safeStat(targetPath: string) {
  try {
    return fs.lstatSync(targetPath)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

export function safeReadDirectory(directoryPath: string) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

export function copyDistEntryForBridgeWrapper(sourcePath: string, targetPath: string, isDirectory: boolean) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  try {
    if (isDirectory) {
      const targetStat = safeStat(targetPath)
      if (targetStat && !targetStat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true })
      }
      fs.mkdirSync(targetPath, { recursive: true })
      const sourceEntries = safeReadDirectory(sourcePath) ?? []
      const sourceNames = new Set(sourceEntries.map(entry => entry.name))
      for (const entry of safeReadDirectory(targetPath) ?? []) {
        if (!sourceNames.has(entry.name)) {
          fs.rmSync(path.join(targetPath, entry.name), { recursive: true, force: true })
        }
      }
      for (const entry of sourceEntries) {
        copyDistEntryForBridgeWrapper(
          path.join(sourcePath, entry.name),
          path.join(targetPath, entry.name),
          entry.isDirectory(),
        )
      }
      return
    }

    const sourceStat = safeStat(sourcePath)
    const targetStat = safeStat(targetPath)
    // 构建器会重写未改变的文件；镜像不能把时间戳变化放大为 IDE 的整页重载。
    if (
      sourceStat?.isFile()
      && targetStat?.isFile()
      && sourceStat.size === targetStat.size
      && fs.readFileSync(sourcePath).equals(fs.readFileSync(targetPath))
    ) {
      return
    }

    if (targetStat && !targetStat.isFile()) {
      fs.rmSync(targetPath, { recursive: true, force: true })
    }
    fs.copyFileSync(sourcePath, targetPath)
    if (sourceStat?.isFile()) {
      fs.utimesSync(targetPath, sourceStat.atime, sourceStat.mtime)
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}
