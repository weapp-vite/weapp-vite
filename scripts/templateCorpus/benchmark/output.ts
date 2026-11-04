import { mkdir } from 'node:fs/promises'
import path from 'node:path'

/** 原子预留全新运行目录；失败重采也必须保留前次报告和全部样本。 */
export async function reserveProfileOutput(directory: string): Promise<void> {
  await mkdir(path.dirname(directory), { recursive: true })
  try {
    await mkdir(directory)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Performance profile requires a new output directory; choose a unique run path to preserve previous evidence.', { cause: error })
    }
    throw error
  }
}
