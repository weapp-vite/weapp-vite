import { describe, expect, it } from 'vitest'
import { isSafeJavaScriptPatch } from './session'
import { createStatefulHmrBanner, createStatefulHmrFooter, StatefulHmrViteAdapter, toStableModuleId } from './viteAdapter'

describe('stateful HMR Vite adapter', () => {
  it('installs native page registration and flushes component definitions for entry chunks', () => {
    const banner = createStatefulHmrBanner({ fileName: 'pages/index/index.js', isEntry: true })

    expect(banner).toContain('installNative(\'Page\', definition => Page(definition))')
    expect(banner).toContain('installNative(\'Component\', definition => Component(definition))')
    expect(createStatefulHmrFooter({ fileName: 'pages/index/index.js', isEntry: true }))
      .toContain('takeNativeDefinitions(\'Component\')')
  })

  it('keeps virtual ids stable and normalizes source ids relative to root', () => {
    expect(toStableModuleId('\0virtual:entry', '/project')).toBe('\0virtual:entry')
    expect(toStableModuleId('/project/src/pages/index.ts', '/project')).toBe('src/pages/index.ts')
    expect(toStableModuleId('C:\\project\\src\\pages\\index.ts', 'C:\\project')).toBe('src/pages/index.ts')
  })

  it('accepts Vite 8 patch payloads without legacy hmr boundary metadata', () => {
    expect(isSafeJavaScriptPatch(['src/pages/index.ts'], {
      changedIds: ['src/pages/index.ts'],
      code: 'createCjsInitializer("src/pages/index.ts")',
      filename: '__weapp_vite_hmr/update.js',
      seq: 1,
      type: 'Patch',
    })).toBe(true)
  })

  it('owns one stateful DevEngine and maps polling options to its watcher', async () => {
    let registeredClientId = ''
    let legacyListenCalls = 0
    let devOptions: any
    const engine = {
      ensureCurrentBuildFinish: async () => {},
      ensureLatestBuildOutput: async () => {},
      getBundleState: async () => ({ lastBuildErrored: false }),
      registerClient: (clientId: string) => {
        registeredClientId = clientId
      },
      run: async () => {},
      triggerFullBuild: () => {},
    }
    const adapter = new StatefulHmrViteAdapter(
      { build: { rolldownOptions: {} }, root: '/project' } as any,
      {
        environments: {
          client: {
            bundledDev: undefined,
          },
        },
      } as any,
      {
        onError: () => {},
        onOutput: () => {},
        onPatch: () => true,
        waitForInitialBundle: async () => {},
      },
      { compareContentsForPolling: true, pollInterval: 120, usePolling: true },
      (async (_input: unknown, _output: unknown, options: unknown) => {
        devOptions = options
        return engine
      }) as any,
    )
    const bundledDev = {
      getRolldownOptions: async () => ({}),
      listen: async () => {
        legacyListenCalls += 1
      },
      storeOutputFiles: () => {},
    }

    Reflect.set(adapter as object, 'server', {
      environments: {
        client: {
          bundledDev,
        },
      },
    })

    adapter.install()
    await bundledDev.listen()

    expect(registeredClientId).toBe('weapp-vite-stateful-hmr')
    expect(legacyListenCalls).toBe(0)
    expect(bundledDev._devEngine).toBe(engine)
    expect(devOptions.watch).toEqual({
      compareContentsForPolling: true,
      pollInterval: 120,
      skipWrite: true,
      usePolling: true,
    })
  })

  it('passes one complete runtime and disables Rolldown implicit injection', async () => {
    const bundledDev = {
      _devEngine: {},
      clients: { setupIfNeeded: () => {} },
      getRolldownOptions: async () => ({}),
      handleHmrOutput: () => {},
      listen: async () => {},
      storeOutputFiles: () => {},
    }
    const adapter = new StatefulHmrViteAdapter(
      { build: { rolldownOptions: {} }, root: '/project' } as any,
      { environments: { client: { bundledDev } } } as any,
      {
        onError: () => {},
        onOutput: () => {},
        onPatch: () => true,
        waitForInitialBundle: async () => {},
      },
    )

    adapter.install()
    const options = await bundledDev.getRolldownOptions() as any

    expect(options.experimental.devMode.skipCommonRuntimeInjection).toBe(true)
    expect(options.experimental.devMode.implement.match(/class DevRuntime/g)).toHaveLength(1)
    expect(options.experimental.devMode.implement).toContain('class WeappViteDevRuntime')
  })

  it('prepares fallback assets before triggering and awaiting a full rebuild', async () => {
    const calls: string[] = []
    const adapter = new StatefulHmrViteAdapter(
      { root: '/project' } as any,
      {} as any,
      {
        onError: () => {},
        onOutput: () => {},
        onPatch: () => true,
        waitForInitialBundle: async () => {},
      },
    )
    Reflect.set(adapter as object, 'bundledDev', {
      _devEngine: {
        ensureLatestBuildOutput: async () => {
          calls.push('latest-output')
        },
        triggerFullBuild: () => {
          calls.push('trigger-full')
        },
      },
    })

    await adapter.rebuild(async () => {
      calls.push('prepare')
    })

    expect(calls).toEqual(['prepare', 'trigger-full', 'latest-output'])
  })

  it('routes DevEngine no-op updates through the stateful fallback', async () => {
    const fallbackFiles: string[][] = []
    let devOptions: any
    const engine = {
      ensureCurrentBuildFinish: async () => {},
      getBundleState: async () => ({ lastBuildErrored: false }),
      registerClient: async () => {},
      run: async () => {},
    }
    const adapter = new StatefulHmrViteAdapter(
      { build: { rolldownOptions: {} }, root: '/project' } as any,
      {
        environments: {
          client: {
            bundledDev: {
              getRolldownOptions: async () => ({}),
              listen: async () => {},
              storeOutputFiles: () => {},
            },
          },
        },
      } as any,
      {
        onError: () => {},
        onOutput: () => {},
        onPatch: (files) => {
          fallbackFiles.push(files)
          return false
        },
        waitForInitialBundle: async () => {},
      },
      {},
      (async (_input: unknown, _output: unknown, options: unknown) => {
        devOptions = options
        return engine
      }) as any,
    )

    adapter.install()
    const bundledDev = (adapter as any).bundledDev
    await bundledDev.listen()
    devOptions.onHmrUpdates({
      changedFiles: ['src/pages/index.wxml'],
      updates: [{
        clientId: 'weapp-vite-stateful-hmr',
        update: { type: 'Noop' },
      }],
    })

    expect(fallbackFiles).toEqual([['src/pages/index.wxml']])
  })

  it('keeps Vite 7 module registration compatibility when available', async () => {
    const registeredModules: string[] = []
    const deliveredPayloads: string[] = []
    const adapter = new StatefulHmrViteAdapter(
      { root: '/project' } as any,
      {} as any,
      {
        onError: () => {},
        onOutput: () => {},
        onPatch: () => true,
        waitForInitialBundle: async () => {},
      },
    )
    Reflect.set(adapter as object, 'bundledDev', {
      _devEngine: {
        notifyPayloadDelivered: (filename: string) => {
          deliveredPayloads.push(filename)
        },
        registerModules: (_clientId: string, modules: string[]) => {
          registeredModules.push(...modules)
        },
      },
    })

    await expect(adapter.registerBundleModules([
      {
        code: 'registerModule("src/pages/index.ts")',
        fileName: 'pages/index/index.js',
        modules: {
          '/project/src/components/card.ts': {},
        },
        type: 'chunk',
      },
    ])).resolves.toBe(2)
    await adapter.registerPatchModules('createCjsInitializer("src/pages/detail.ts")')
    await adapter.markPayloadDelivered('__weapp_vite_hmr/update.js')

    expect(registeredModules).toEqual([
      'src/pages/index.ts',
      'src/components/card.ts',
      'src/pages/detail.ts',
    ])
    expect(deliveredPayloads).toEqual([
      'pages/index/index.js',
      '__weapp_vite_hmr/update.js',
    ])
  })
})
