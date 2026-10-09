import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { acquireMachineE2ELease } from '../../../packages/devtools-runtime/src/lease/machine'
import { createManagedWechatProjectJournal, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'

export interface IsolatedMachineLease {
  stateDirectory: string
  journalPath: string
  environment: Record<string, string>
  dispose: () => Promise<void>
}

/** 基础设施测试保留真实租约协议，但全部 scope 与空窗口日志只属于本测试临时目录。 */
export async function createIsolatedMachineLease(): Promise<IsolatedMachineLease> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'e2e-machine-fixture-'))
  const stateDirectory = path.join(root, 'state')
  const lease = await acquireMachineE2ELease({ stateDirectory, env: {} })
  const journalPath = await createManagedWechatProjectJournal(path.join(root, 'journals'))
  const scope = await lease.createChildScope({ cleanupKey: journalPath })
  return {
    stateDirectory,
    journalPath,
    environment: { ...scope.environment, [MANAGED_PROJECT_JOURNAL_ENV]: journalPath },
    dispose: async () => {
      // 子进程与故意保留的子 scope 必须先由测试收尾，失败时不删除剩余证据。
      await scope.seal()
      if ((await readManagedWechatProjectRecords(journalPath)).some(record => record.state !== 'released')) {
        throw new Error('Isolated machine fixture still has unreleased project records.')
      }
      await scope.complete()
      await lease.release()
      await rm(root, { recursive: true, force: true })
    },
  }
}
