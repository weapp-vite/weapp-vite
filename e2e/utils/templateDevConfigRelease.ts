import { lstat } from 'node:fs/promises'
import path from 'node:path'
import { classicIdeConfigLeasePath } from '../../packages/weapp-vite/src/runtime/classicIdeConfig/leases'

/** 只验证开发命令自行释放配置；残留文件由原 owner 恢复，验收不能代删。 */
export async function assertTemplateDevConfigReleased(projectRoot: string) {
  const journal = classicIdeConfigLeasePath(path.join(projectRoot, 'project.private.config.json'))
  try {
    await lstat(journal)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw error
  }
  throw new Error('Template development shutdown did not release its classic IDE configuration lease')
}
