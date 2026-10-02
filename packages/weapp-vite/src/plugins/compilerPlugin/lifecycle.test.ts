import type { CompilerContext } from '../../context'
import type { WatcherService } from '../../runtime/watcherPlugin'
import { expect, it, vi } from 'vitest'
import { retainWatcherService } from '../../runtime/watcherPlugin'
import { createCompilerPluginPlugins } from './index'

function hook(plugin: any, name: string) {
  const value = plugin[name]
  return typeof value === 'function' ? value : value.handler
}

it('retains snapshot controllers until development closes and forwards pending changes before rebuilding', async () => {
  const events: string[] = []
  const watcherService = { closeAll: vi.fn() } as unknown as WatcherService
  const pending: Array<{ file: string, event: string }> = []
  const ctx = {
    watcherService,
    moduleGraphService: { getPendingChanges: () => pending },
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      platform: 'weapp',
      isDev: true,
      outputExtensions: { wxss: 'wxss' },
      weappViteConfig: { compilerPlugins: [{ name: 'lifecycle', create: () => ({
        buildStart: () => { events.push('build') },
        watchChange: () => { events.push('watch') },
        closeBundle: () => { events.push('close') },
        dispose: () => { events.push('dispose') },
      }) }] },
    },
  } as unknown as CompilerContext
  const [source, output] = createCompilerPluginPlugins(ctx)
  const release = retainWatcherService(watcherService)
  hook(source, 'configResolved').call({}, { command: 'build', build: {} })
  await hook(source, 'buildStart').call({})
  await hook(output, 'closeBundle').call({})
  expect(events).toEqual(['build'])
  pending.push({ file: '/project/src/tokens.json', event: 'update' })
  await hook(source, 'buildStart').call({})
  await hook(output, 'closeBundle').call({})
  expect(events).toEqual(['build', 'watch', 'build'])
  await release()
  await release()
  await hook(output, 'closeBundle').call({})
  expect(events).toEqual(['build', 'watch', 'build', 'close', 'dispose'])
})
