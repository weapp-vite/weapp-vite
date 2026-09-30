import { expect, it, vi } from 'vitest'
import { deferWatcherResourceCleanup } from '../runtime/watcherPlugin'
import { WeappBuildSession } from './session'

it('closes once and waits for a pending entry scan before releasing owned resources', async () => {
  const session = new WeappBuildSession()
  const released = vi.fn()
  deferWatcherResourceCleanup(session.context.watcherService, released)
  session.state = 'ready'
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  vi.spyOn(session.context.scanService, 'loadAppEntry').mockImplementation(async () => {
    await pending
    return { json: { pages: [] } } as Awaited<ReturnType<typeof session.context.scanService.loadAppEntry>>
  })
  const validation = session.validateEntries()
  const rejected = expect(validation).rejects.toThrow('已关闭')
  const closing = session.close()
  expect(session.close()).toBe(closing)
  await Promise.resolve()
  expect(released).not.toHaveBeenCalled()
  expect(session.state).toBe('closing')
  finish()
  await rejected
  await closing
  expect(released).toHaveBeenCalledOnce()
  expect(session.state).toBe('closed')
})

it('releases only its own resources and reaches closed even when cleanup rejects', async () => {
  const first = new WeappBuildSession()
  const second = new WeappBuildSession()
  const secondCleanup = vi.fn()
  deferWatcherResourceCleanup(first.context.watcherService, () => {
    throw new Error('cleanup failed')
  })
  deferWatcherResourceCleanup(second.context.watcherService, secondCleanup)
  await expect(first.close()).rejects.toThrow('resource cleanup failed')
  expect(first.state).toBe('closed')
  expect(second.state).toBe('created')
  expect(secondCleanup).not.toHaveBeenCalled()
  await second.close()
  expect(secondCleanup).toHaveBeenCalledOnce()
})
