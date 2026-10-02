import { expect } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../../src/browser'

/** 与 IDE 保持相同的回调、延迟 Promise 和全局 nextTick 观察边界。 */
export async function assertSetDataPhases(files: Array<[string, string]>) {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
  try {
    const native = session.reLaunch('/pages/issue-1138/index')
    await expect.poll(() => native._readE2E().at(-1)?.phase?.name).toBe('commit')
    await native._beginE2E()
    await expect.poll(() => native._readE2E().at(-1)?.phase?.name).toBe('commit')
    expect(native._readE2E().map((info: any) => info.phase.name)).toEqual(['prepare', 'dispatch', 'commit'])
    expect(native._readE2E().at(-1)).toMatchObject({ phase: { completion: 'callback', result: 'committed', visibleAt: null } })
    expect(native.data.count).toBe(1)
    const delayed = session.reLaunch('/pages/issue-1138/delayed')
    await expect.poll(() => delayed._readE2E().events.at(-1)?.phase?.name).toBe('commit')
    await delayed._beginE2E()
    await expect.poll(() => delayed._readE2E().queueDrained).toBe(true)
    const before = delayed._readE2E()
    expect(before.events.map((info: any) => info.phase.name)).toEqual(['prepare', 'dispatch'])
    await expect.poll(() => delayed._readE2E().nativeCallbackCompleted).toBe(true)
    expect(delayed.data.count).toBe(1)
    await delayed._releaseE2E()
    await expect.poll(() => delayed._readE2E().events.at(-1)?.phase?.name).toBe('commit')
    expect(delayed._readE2E().events.at(-1)).toMatchObject({ phase: { completion: 'promise', result: 'committed', visibleAt: null } })
  }
  finally {
    session.close()
  }
}
