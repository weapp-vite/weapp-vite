import type { ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { attachDevModuleGraphHost, connectDevModuleGraphHost, notifyDevModuleGraphHost } from './host'
import { createModuleGraphService } from './service'

function fixture() {
  const release = vi.fn()
  const context = { moduleGraphService: createModuleGraphService() }
  vi.spyOn(context.moduleGraphService, 'bindDevServer').mockReturnValue(release)
  const detach = attachDevModuleGraphHost(context, {} as ViteDevServer)
  return { context, release, detach }
}

it('transfers watcher events captured before provider attachment exactly once', async () => {
  const first = fixture()
  const second = fixture()
  const change = { file: 'src/app.json', event: 'update' as const }
  const consumer = vi.fn()
  const otherConsumer = vi.fn()
  notifyDevModuleGraphHost(first.context, change)
  notifyDevModuleGraphHost(second.context, { file: 'src/other.js', event: 'update' })
  const provider = connectDevModuleGraphHost(first.context, consumer)!
  expect(consumer).toHaveBeenCalledExactlyOnceWith(change)
  expect(otherConsumer).not.toHaveBeenCalled()
  await provider.close()
  await provider.close()
  expect(first.release).toHaveBeenCalledOnce()
  const replacement = connectDevModuleGraphHost(first.context, consumer)!
  expect(consumer).toHaveBeenCalledOnce()
  const otherProvider = connectDevModuleGraphHost(second.context, otherConsumer)!
  expect(otherConsumer).toHaveBeenCalledExactlyOnceWith({ file: 'src/other.js', event: 'update' })
  await Promise.all([replacement.close(), otherProvider.close()])
  first.detach()
  second.detach()
})

it('drops pending events when their owning host detaches', async () => {
  const project = fixture()
  const consumer = vi.fn()
  notifyDevModuleGraphHost(project.context, { file: 'src/stale.js', event: 'update' })
  project.detach()
  project.detach()
  const detachReplacement = attachDevModuleGraphHost(project.context, {} as ViteDevServer)
  const provider = connectDevModuleGraphHost(project.context, consumer)!
  expect(consumer).not.toHaveBeenCalled()
  await provider.close()
  detachReplacement()
})
