import type { ViteDevServer } from 'vite'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DEVFRAME_CONNECTION_META_FILENAME, DEVFRAME_SSE_ROUTE, DEVFRAME_WS_ROUTE } from 'devframe/constants'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { createAnalyzeDashboardDevframe } from '../../dashboard'
import { ANALYZE_DASHBOARD_DEVFRAME_BASE, createAnalyzeDashboardViteBridge } from './dashboardViteBridge'

it('serves native Vite pages and assets beside real Devframe discovery and SSE', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-bridge-')))
  const controller = createAnalyzeDashboardDevframe({
    snapshot: {
      current: {
        packages: [{ id: '__main__', label: 'Main', type: 'main', files: [] }],
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
    roots: { projectRoot: root },
  })
  let server: ViteDevServer | undefined
  try {
    vi.stubEnv('DEVFRAME_INSTANCES_DIR', path.join(root, 'instances'))
    await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><main>Portable Dashboard page</main>')
    await fs.writeFile(path.join(root, 'probe.txt'), 'Dashboard client asset')
    server = await createServer({
      root,
      base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
      configFile: false,
      logLevel: 'silent',
      plugins: [createAnalyzeDashboardViteBridge(controller)],
      server: { host: '127.0.0.1', port: 0 },
    })
    await server.listen()
    const baseUrl = server.resolvedUrls?.local[0]
    if (!baseUrl) {
      throw new Error('Dashboard server did not expose its listening URL')
    }

    const page = await fetch(baseUrl)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<main>Portable Dashboard page</main>')

    const asset = await fetch(new URL('probe.txt', baseUrl))
    expect(asset.status).toBe(200)
    expect(await asset.text()).toBe('Dashboard client asset')

    const historyRoute = await fetch(new URL('analyze?tab=treemap', baseUrl))
    expect(historyRoute.status).toBe(200)
    expect(await historyRoute.text()).toContain('<main>Portable Dashboard page</main>')

    const discovery = await fetch(new URL(`${DEVFRAME_CONNECTION_META_FILENAME}?cache=1`, baseUrl))
    const metadata: unknown = await discovery.json()
    expect(discovery.status).toBe(200)
    expect(metadata).toMatchObject({
      backend: 'websocket',
      websocket: { path: DEVFRAME_WS_ROUTE },
      sse: { path: DEVFRAME_SSE_ROUTE },
    })

    const abort = new AbortController()
    try {
      const stream = await fetch(new URL(DEVFRAME_SSE_ROUTE, baseUrl), { signal: abort.signal })
      expect(stream.status).toBe(200)
      expect(stream.headers.get('content-type')).toContain('text/event-stream')
      await stream.body?.cancel()
    }
    finally {
      abort.abort()
    }
  }
  finally {
    try {
      await server?.close()
    }
    finally {
      controller.dispose()
      vi.unstubAllEnvs()
      await fs.rm(root, { recursive: true, force: true })
    }
  }
})
