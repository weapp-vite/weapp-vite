import type { ServerWatchOptions, ViteDevServer } from 'vite'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { resolvePollingFixtureRoot } from './pollingFixture.mjs'

interface BackendScenario {
  name: string
  environment?: string
  watch: ServerWatchOptions
  polling: boolean
}

const scenarios: BackendScenario[] = [
  { name: 'environment true overrides explicit false', environment: 'true', watch: { usePolling: false }, polling: true },
  { name: 'environment 1 overrides FSEvents', environment: '1', watch: { useFsEvents: true }, polling: true },
  { name: 'explicit polling overrides FSEvents', watch: { usePolling: true, useFsEvents: true }, polling: true },
  { name: 'explicit polling preserves FSEvents false', watch: { usePolling: true, useFsEvents: false }, polling: true },
  { name: 'environment false overrides explicit polling', environment: 'false', watch: { usePolling: true }, polling: false },
  { name: 'environment 0 preserves explicit false', environment: '0', watch: { usePolling: false, useFsEvents: false }, polling: false },
  { name: 'explicit false preserves native selection', watch: { usePolling: false, useFsEvents: false }, polling: false },
]

it.each(scenarios)('selects the real Vite watcher backend: $name', async ({ environment, watch, polling }) => {
  const changes: string[] = []
  const errors: unknown[] = []
  let ready = false
  let directory: string | undefined
  let server: ViteDevServer | undefined
  try {
    vi.stubEnv('CHOKIDAR_USEPOLLING', environment)
    vi.stubEnv('CHOKIDAR_INTERVAL', undefined)
    directory = await mkdtemp(path.join(os.tmpdir(), 'vite-polling-backend-'))
    const root = resolvePollingFixtureRoot(directory)
    const file = path.join(root, 'source.txt')
    await writeFile(file, 'initial')
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true },
      server: { hmr: false, middlewareMode: true, watch: { interval: 20, ...watch } },
      plugins: [{
        name: 'contract:observe-polling-backend',
        configureServer(host) {
          ready = (host.watcher as typeof host.watcher & { _readyEmitted?: boolean })._readyEmitted === true
          host.watcher.on('ready', () => {
            ready = true
          })
          host.watcher.on('change', changed => changes.push(path.relative(root, changed).replaceAll('\\', '/')))
          host.watcher.on('error', error => errors.push(error))
        },
      }],
    })
    expect(server.watcher.options.usePolling).toBe(polling)
    if (polling) {
      expect(server.watcher.options.useFsEvents).toBe(false)
      await expect.poll(() => ready, { timeout: 5000 }).toBe(true)
      await writeFile(file, 'changed through the actual polling subscription')
      await expect.poll(() => changes, { timeout: 5000 }).toContain('source.txt')
    }
    else if (watch.useFsEvents === false) {
      expect(server.watcher.options.useFsEvents).toBe(false)
    }
    expect(errors).toEqual([])
  }
  finally {
    try {
      await server?.close()
    }
    finally {
      vi.unstubAllEnvs()
      if (directory) {
        await rm(directory, { recursive: true, force: true })
      }
    }
  }
}, 15_000)
