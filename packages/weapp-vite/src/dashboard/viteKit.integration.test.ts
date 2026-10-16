import type { ResolvedConfig } from 'vite'
import type { AnalyzeSubpackagesResult } from '../analyze/subpackages/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import { createKitContext } from '@vitejs/devtools-kit/node'
import path from 'pathe'
import { resolveConfig } from 'vite'
import { expect, it, vi } from 'vitest'
import { createAnalyzeDashboardDevframe } from './index'
import { createAnalyzeDashboardPlugin } from './vite'

function analyzeResult(label: string): AnalyzeSubpackagesResult {
  return {
    packages: [{ id: 'main', label, type: 'main', files: [] }],
    modules: [],
    subPackages: [],
    glassEasel: {
      detected: false,
      minimumBaseLibrary: '3.8.12',
      migrationGuide: '',
      diagnostics: [],
      summary: { errors: 0, warnings: 0 },
    },
  }
}

it('mounts through the real Kit adapter and releases only the current host generation', async () => {
  const root = path.normalize(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-kit-')))
  const controller = createAnalyzeDashboardDevframe({
    clientAssets: root,
    roots: { projectRoot: root },
    snapshot: { current: analyzeResult('initial'), previous: null, artifacts: new Map() },
  })
  const dispose = vi.spyOn(controller, 'dispose')
  try {
    await fs.writeFile(path.join(root, 'index.html'), '<main>Dashboard</main>')
    const firstConfig = await resolveConfig({ root, configFile: false, logLevel: 'silent' }, 'serve')
    const currentConfig = { ...firstConfig }
    const plugin = createAnalyzeDashboardPlugin(controller, { base: '//tools//dashboard//' })
    const mountStatic = vi.fn()
    const mountConnectionMeta = vi.fn()
    const createContext = async (viteConfig: ResolvedConfig, generation: string) => Object.assign(await createKitContext({
      cwd: root,
      mode: 'dev',
      host: {
        mountStatic,
        mountConnectionMeta,
        resolveOrigin: () => 'http://localhost',
        getStorageDir: scope => path.join(root, generation, scope),
      },
    }), { viteConfig })
    const first = await createContext(firstConfig, 'first')
    const current = await createContext(currentConfig, 'current')
    const setup = plugin.devtools!.setup
    await setup(first)
    await setup(current)

    expect(mountStatic.mock.calls).toEqual([
      ['/tools/dashboard/', root],
      ['/tools/dashboard/', root],
    ])
    expect(mountConnectionMeta.mock.calls).toEqual([
      ['/tools/dashboard/'],
      ['/tools/dashboard/'],
    ])
    expect(current.docks.values()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'weapp-vite', type: 'iframe', url: '/tools/dashboard/' }),
    ]))
    const dashboard = current.scope('weapp-vite')
    const initial = await dashboard.rpc.call('get-dashboard-state')
    expect(initial.revision).toBe(0)
    await controller.update(analyzeResult('updated'), new Map())
    expect(await dashboard.rpc.call('get-dashboard-state')).toMatchObject({
      sessionId: initial.sessionId,
      revision: 1,
      analyze: { previous: initial.analyze.current },
    })

    const closeBundle = typeof plugin.closeBundle === 'function' ? plugin.closeBundle : plugin.closeBundle!.handler
    const close = (config: ResolvedConfig) => closeBundle.call({
      environment: { getTopLevelConfig: () => config },
    } as ThisParameterType<typeof closeBundle>)
    await close(firstConfig)
    expect(dispose).not.toHaveBeenCalled()
    expect(await dashboard.rpc.call('get-dashboard-state')).toMatchObject({ revision: 1 })
    await close(currentConfig)
    await close(currentConfig)
    expect(dispose).toHaveBeenCalledTimes(1)
    await expect(dashboard.rpc.call('get-dashboard-state')).rejects.toThrow()
    await controller.update(analyzeResult('after close'), new Map())
    await expect(dashboard.rpc.call('get-dashboard-state')).rejects.toThrow()
  }
  finally {
    controller.dispose()
    await fs.rm(root, { recursive: true, force: true })
  }
})
