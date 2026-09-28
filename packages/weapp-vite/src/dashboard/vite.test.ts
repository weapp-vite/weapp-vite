import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { initDevframe } from 'devframe/initiate'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createAnalyzeDashboardDevframe } from './index'
import { createAnalyzeDashboardPlugin } from './vite'

function createController(projectRoot: string) {
  return createAnalyzeDashboardDevframe({
    snapshot: {
      current: {
        packages: [{ id: 'private-dashboard-report', label: 'private-dashboard-report', type: 'main', files: [] }],
        modules: [],
        subPackages: [],
        glassEasel: {
          detected: false,
          minimumBaseLibrary: '3.8.12',
          migrationGuide: '',
          diagnostics: [],
          summary: { errors: 0, warnings: 0 },
        },
      },
      previous: null,
      artifacts: new Map(),
    },
    roots: { projectRoot },
  })
}

it('builds the consumer application without optional Dashboard assets or report output', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-production-'))
  const controller = createController(root)
  try {
    await fs.writeFile(path.join(root, 'index.html'), '<html><body><h1>Public application</h1></body></html>')
    const result = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [createAnalyzeDashboardPlugin(controller)],
      build: { write: false, watch: null },
    })
    if (!Array.isArray(result) && 'on' in result) {
      await result.close()
      throw new Error('Expected a completed production build, not a watcher')
    }
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output)
    const html = outputs.find(output => output.type === 'asset' && output.fileName === 'index.html')
    if (!html || html.type !== 'asset') {
      throw new Error('Consumer HTML was not emitted')
    }
    const decode = (source: string | Uint8Array) => typeof source === 'string' ? source : new TextDecoder().decode(source)
    expect(decode(html.source)).toContain('<h1>Public application</h1>')
    expect(outputs.map(output => output.type === 'asset' ? decode(output.source) : output.code).join('\n'))
      .not
      .toContain('private-dashboard-report')
  }
  finally {
    controller.dispose()
    await fs.rm(root, { recursive: true, force: true })
  }
})

it('releases the controller when initial Vite asset validation fails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-invalid-assets-'))
  const controller = createController(root)
  // 独立宿主只用于观察控制器是否释放，不替代真实 Vite 重启回归。
  const observer = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false })
  try {
    await observer.ready
    const dashboard = (await observer.context).scope('weapp-vite')
    await dashboard.rpc.call('get-dashboard-state')
    const setup = createAnalyzeDashboardPlugin(controller).devtools!.setup
    await expect(setup({ viteConfig: { command: 'serve' } } as Parameters<typeof setup>[0])).rejects.toThrow()
    await expect(dashboard.rpc.call('get-dashboard-state')).rejects.toThrow()
    await expect(dashboard.rpc.call('get-analyze-page', { target: 'current', index: 0, revision: 0 })).rejects.toThrow()
  }
  finally {
    controller.dispose()
    await observer.close()
    await fs.rm(root, { recursive: true, force: true })
  }
})
