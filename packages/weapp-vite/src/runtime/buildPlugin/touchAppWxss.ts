import type { MpPlatform } from '../../types'
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
 * 让微信开发者工具重新读取本轮原生构建发布的样式资产。
 *
 * 原生 bundler 已经负责写入内容；这里仅更新已存在文件的元数据，避免
 * 直接写回构建产物，同时覆盖页面和分包样式（而不是只刷新 app.wxss）。
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
  await Promise.all(Array.from(files, fileName => touchExistingAppStyle(fileName)))
  return files
}
