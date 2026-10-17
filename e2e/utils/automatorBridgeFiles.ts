import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

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

let bridgeSyncTempSequence = 0

function publishBridgeWrapperFile(sourcePath: string, targetPath: string, sourceStat: fs.Stats) {
  const tempPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.weapp-vite-sync-${process.pid}-${bridgeSyncTempSequence += 1}.tmp`,
  )
  try {
    // 先在同一目录写完整文件，再一次 rename 发布，避免 IDE watcher 读到截断内容。
    fs.copyFileSync(sourcePath, tempPath)
    fs.chmodSync(tempPath, sourceStat.mode)
    fs.utimesSync(tempPath, sourceStat.atime, sourceStat.mtime)
    try {
      fs.renameSync(tempPath, targetPath)
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EEXIST' && code !== 'EPERM') {
        throw error
      }
      // 某些 Windows 文件系统不允许 rename 覆盖已存在文件；降级时仍保持完整文件发布。
      fs.rmSync(targetPath, { force: true })
      fs.renameSync(tempPath, targetPath)
    }
  }
  finally {
    if (safeStat(tempPath)) {
      fs.rmSync(tempPath, { force: true })
    }
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
    if (sourceStat?.isFile()) {
      publishBridgeWrapperFile(sourcePath, targetPath, sourceStat)
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}
