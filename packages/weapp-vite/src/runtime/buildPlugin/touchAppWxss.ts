import type { MpPlatform } from '../../types'
import { randomUUID } from 'node:crypto'
import { rename } from 'node:fs/promises'
import { supportsMiniProgramAutoTouchAppStyle } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'

export type TouchAppWxssOption = boolean | 'auto' | undefined

function isCompilerContentDirtyReason(reason: string) {
  return /^(?:compiler-content|tailwind-content):/.test(reason)
}

export function resolveTouchAppWxssEnabled(options: {
  option?: TouchAppWxssOption
  platform: MpPlatform
  dirtyReasonSummary?: readonly string[]
  managedCompiler?: boolean
  managedTailwindcss?: boolean
}): boolean {
  const resolvedOption = options.option ?? 'auto'
  if (resolvedOption === true) {
    return true
  }
  if (resolvedOption === false) {
    return false
  }
  // 内置 compiler 已通过原生 emit 更新样式，不再追加可能让 AppService 丢失状态的全局重载。
  return supportsMiniProgramAutoTouchAppStyle(options.platform)
    && !options.managedCompiler
    && !options.managedTailwindcss
    && options.dirtyReasonSummary?.some(isCompilerContentDirtyReason) === true
}

/** 兼容显式全局刷新，只更新原生构建器已写出的产物时间戳，绝不补写空文件。 */
export async function touchExistingAppStyle(filename: string) {
  const time = new Date()
  try {
    await fs.utimes(filename, time, time)
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * 通过同目录原子重命名重新发出宿主文件事件，同时保留 bundler 已写入的内容。
 *
 * 微信开发者工具对部分 WXSS 只更新时间戳不会重新构建 CSSOM；临时文件与目标
 * 文件位于同一目录，避免跨设备复制，也不在这里生成或改写构建内容。
 */
async function recreateExistingStyle(filename: string) {
  const temporary = `${filename}.weapp-vite-style-${randomUUID()}.tmp`
  let moved = false
  try {
    await rename(filename, temporary)
    moved = true
    await rename(temporary, filename)
    moved = false
    return await touchExistingAppStyle(filename)
  }
  catch (error) {
    if (moved) {
      try {
        await rename(temporary, filename)
        moved = false
      }
      catch (restoreError) {
        // 原生构建器可能在两次重命名之间接管并替换文件；此时临时文件
        // 已被并发清理，保留宿主刚写入的文件并结束本轮触发即可。
        if ((error as NodeJS.ErrnoException).code === 'ENOENT'
          && (restoreError as NodeJS.ErrnoException).code === 'ENOENT') {
          moved = false
          return false
        }
        throw new AggregateError([error, restoreError], `无法恢复样式文件：${filename}`)
      }
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
  finally {
    if (!moved) {
      await fs.rm(temporary, { force: true }).catch(() => {})
    }
  }
}

/**
 * 让微信开发者工具重新读取本轮原生构建发布的样式资产。
 *
 * 原生 bundler 已经负责写入内容；这里仅重新发布已存在文件，避免直接写回
 * 构建产物，同时覆盖页面和分包样式（而不是只刷新 app.wxss）。
 */
export async function touchExistingOutputStyles(
  outDir: string,
  fileNames: Iterable<string>,
  styleExtension: string,
) {
  const suffix = `.${styleExtension.replace(/^\./, '')}`
  const resolvedOutDir = path.resolve(outDir)
  const files = new Set<string>()
  for (const fileName of fileNames) {
    const normalized = fileName.replaceAll('\\', '/')
    // app.wxss 的刷新仍由现有 touchAppWxss 策略单独决定，避免页面样式补丁
    // 意外触发 AppService 全局重载。
    if (normalized.endsWith(suffix) && normalized !== `app${suffix}`) {
      const target = path.resolve(resolvedOutDir, normalized)
      const relative = path.relative(resolvedOutDir, target)
      if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        continue
      }
      files.add(target)
    }
  }
  await Promise.all(Array.from(files, fileName => recreateExistingStyle(fileName)))
  return files
}
