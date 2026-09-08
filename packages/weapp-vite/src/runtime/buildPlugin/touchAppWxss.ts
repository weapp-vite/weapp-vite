import type { MpPlatform } from '../../types'
import { supportsMiniProgramAutoTouchAppStyle } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'

export type TouchAppWxssOption = boolean | 'auto' | undefined

export function resolveTouchAppWxssEnabled(options: {
  option?: TouchAppWxssOption
  platform: MpPlatform
  dirtyReasonSummary?: readonly string[]
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
    && !options.managedTailwindcss
    && options.dirtyReasonSummary?.some(reason => reason.startsWith('tailwind-content:')) === true
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
