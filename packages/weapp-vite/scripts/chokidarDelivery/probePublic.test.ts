import assert from 'node:assert/strict'
import { win32 } from 'node:path'
import { beforeEach, it, vi } from 'vitest'
import { closeOwner, openPublicOwner } from './probe/public.mjs'

const publicApi = vi.hoisted(() => ({ watchTestArtifact: vi.fn() }))

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>()
  return { ...actual, default: actual.win32 }
})

vi.mock('weapp-vite/test', () => publicApi)

interface Owner {
  kind: string
  outDir: string
  close: () => Promise<void>
}

const root = String.raw`C:\consumer\projects\fixture`
const outDir = win32.join(root, '.weapp-vite', 'delivery-artifact')

function createWatcher(miniprogramRootPath: string) {
  const native = { closeCalls: 0, closeEvents: 0 }
  let closed = false
  const close = vi.fn(async () => {
    if (!closed) {
      closed = true
      native.closeCalls++
      native.closeEvents++
    }
  })
  return { artifact: { miniprogramRootPath }, native, close }
}

beforeEach(() => {
  publicApi.watchTestArtifact.mockReset()
})

it('Windows 公开产物路径接受等价分隔符，重复公开关闭只释放一次原生句柄', async () => {
  const watcher = createWatcher(outDir.replaceAll('\\', '/'))
  publicApi.watchTestArtifact.mockResolvedValue(watcher)
  const owners: Owner[] = []
  const owner = await openPublicOwner('artifact', root, owners, [])
  assert.equal(owners.length, 1)
  assert.equal(owners[0], owner)
  assert.equal(owner.outDir, outDir)
  await closeOwner(owner)
  assert.equal(watcher.close.mock.calls.length, 2)
  assert.deepEqual(watcher.native, { closeCalls: 1, closeEvents: 1 })
})

it.each([
  ['其他目录', win32.join(root, '.weapp-vite', 'wrong-artifact')],
  ['其他磁盘', outDir.replace(/^C:/, 'D:')],
])('Windows 公开产物路径拒绝%s，断言失败前登记的 owner 仍可幂等收尾', async (_label, incorrectPath) => {
  const watcher = createWatcher(incorrectPath.replaceAll('\\', '/'))
  publicApi.watchTestArtifact.mockResolvedValue(watcher)
  const owners: Owner[] = []
  await assert.rejects(openPublicOwner('artifact', root, owners, []), { code: 'ERR_ASSERTION' })
  assert.equal(owners.length, 1)
  assert.equal(owners[0].outDir, outDir)
  await closeOwner(owners[0])
  assert.equal(watcher.close.mock.calls.length, 2)
  assert.deepEqual(watcher.native, { closeCalls: 1, closeEvents: 1 })
})
