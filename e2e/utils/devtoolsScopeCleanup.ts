import type { MachineE2EChildScope } from '../../packages/devtools-runtime/src/lease/machine'
import path from 'node:path'
import { cleanupManagedWechatProjects, readManagedWechatProjectRecords } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { resolveManagedJournalScope } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/scope'

async function assertDescendantJournal(parent: string, child: string) {
  const relative = path.relative(parent, child)
  const parts = relative.split(path.sep)
  if (!path.isAbsolute(child) || child !== path.resolve(child) || !relative || path.isAbsolute(relative)
    || parts.length % 2 !== 0 || parts.some((part, index) => index % 2 === 0 ? part !== 'children' : !part || part === '..')) {
    throw new Error('E2E descendant cleanup key is outside its explicitly owned journal subtree.')
  }
  const parentScope = await resolveManagedJournalScope(parent)
  const childScope = await resolveManagedJournalScope(child)
  if (!parentScope.scopeId || parentScope.scopeId !== childScope.scopeId || parentScope.rootPath !== childScope.rootPath) {
    throw new Error('E2E descendant cleanup key belongs to another journal ownership scope.')
  }
  return childScope
}

/** 仅接管已确认停止、且预先绑定于本日志子树的后代；实际回收成功后才完成命令作用域。 */
export async function cleanupDevtoolsCommandScope(scope: MachineE2EChildScope | undefined, journalPath: string) {
  await scope?.recoverStoppedDescendants(async (descendant) => {
    const before = await assertDescendantJournal(journalPath, descendant.cleanupKey)
    await cleanupManagedWechatProjects({ journalPath: descendant.cleanupKey, scope: 'journal' })
    const after = await assertDescendantJournal(journalPath, descendant.cleanupKey)
    if (before.scopeId !== after.scopeId || before.rootPath !== after.rootPath
      || (await readManagedWechatProjectRecords(descendant.cleanupKey)).some(record => record.state !== 'released')) {
      throw new Error('E2E descendant journal identity changed or its resource cleanup is incomplete.')
    }
  })
  await scope?.seal()
  await cleanupManagedWechatProjects({ journalPath, scope: 'journal' })
  await scope?.complete()
}
