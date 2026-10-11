import type { ManagedWechatHostIdentity } from '../types'
import process from 'node:process'
import { readManagedProcessIdentity } from '../host'
import { readWindowsJournalWriterIdentity } from './windowsSelfIdentity'

let currentIdentity: Promise<ManagedWechatHostIdentity> | undefined

/** 共享在途与成功身份；失败仍拒绝当前调用，仅允许下一次显式操作重新核验。 */
export function readManagedJournalWriterIdentity() {
  if (!currentIdentity) {
    const query = process.platform === 'win32'
      ? readWindowsJournalWriterIdentity()
      : readManagedProcessIdentity(process.pid)
    const pending = query.then((identity) => {
      if (!identity) {
        throw new Error('Cannot identify the managed DevTools journal writer.')
      }
      return identity
    })
    currentIdentity = pending
    void pending.catch(() => {
      if (currentIdentity === pending) {
        currentIdentity = undefined
      }
    })
  }
  return currentIdentity
}
