import { fs } from '@weapp-core/shared/fs'

const ATOMIC_SAVE_RECHECK_DELAYS_MS = [20, 60]

/** 删除通知先核验原子保存后的磁盘事实，raw owner 与入口失效沿用同一政策。 */
export async function normalizeAtomicDeleteEvent(id: string): Promise<'update' | 'delete'> {
  for (const delayMs of ATOMIC_SAVE_RECHECK_DELAYS_MS) {
    if (await fs.pathExists(id)) {
      return 'update'
    }
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  return await fs.pathExists(id) ? 'update' : 'delete'
}
