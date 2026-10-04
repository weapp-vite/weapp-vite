import type { InlineConfig, ViteDevServer } from 'vite'
import type { AnalyzeSubpackagesResult } from '../../dashboard'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDevShutdownScope } from '../../devLifecycle/shutdown'
import { startAnalyzeDashboard } from './dashboard'

const fixture = vi.hoisted(() => ({
  root: '',
  stage: 'restart' as 'restart' | 'configure' | 'post-configure',
  servers: [] as ViteDevServer[],
}))

vi.mock('../../dashboard/assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../dashboard/assets')>()
  return { ...actual, resolveDashboardRoot: () => ({ root: fixture.root }) }
})

vi.mock('../../devLifecycle/vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../devLifecycle/vite')>()
  return {
    createDevViteServer: (config: InlineConfig) => actual.createDevViteServer({
      ...config,
      plugins: [...config.plugins ?? [], {
        name: 'dashboard-replacement-probe',
        configureServer(server) {
          fixture.servers.push(server)
          if (fixture.servers.length !== 2 || fixture.stage === 'restart') {
            return
          }
          const reject = () => {
            throw new Error('Dashboard replacement rejected')
          }
          if (fixture.stage === 'configure') {
            reject()
          }
          return reject
        },
      }],
    }),
  }
})

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

const initialExitCode = process.exitCode

beforeEach(async () => {
  process.exitCode = undefined
  if (process.disconnect) {
    vi.spyOn(process, 'disconnect').mockImplementation(() => {})
  }
  fixture.servers = []
  fixture.root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-owned-lifecycle-')))
  await fs.mkdir(path.join(fixture.root, 'instances'))
  await fs.writeFile(path.join(fixture.root, 'index.html'), '<!doctype html><main>Owned Dashboard host</main>')
  vi.stubEnv('DEVFRAME_INSTANCES_DIR', path.join(fixture.root, 'instances'))
  vi.stubEnv('DEVFRAME_DISABLE_INSTANCE_REGISTRY', '')
})

afterEach(async () => {
  process.exitCode = initialExitCode
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await fs.rm(fixture.root, { recursive: true, force: true })
})

it.each(['restart', 'configure', 'post-configure'] as const)('keeps the managed Dashboard alive through native %s and closes its current host', async (stage) => {
  fixture.stage = stage
  const scope = createDevShutdownScope()
  let client: Client | undefined
  try {
    const handle = await scope.run('startup', () => startAnalyzeDashboard(analyzeResult('initial'), {
      artifacts: new Map(),
      cwd: fixture.root,
      watch: true,
      silentStartupLog: true,
    }))
    const server = fixture.servers[0]
    if (!handle || !server) {
      throw new Error('Dashboard did not start')
    }
    const originalHttpServer = server.httpServer
    const exited = vi.fn()
    void handle.waitForExit().then(exited)
    await server.restart()
    expect(fixture.servers).toHaveLength(2)
    expect(exited).not.toHaveBeenCalled()
    expect(scope.stopping).toBe(false)
    if (stage === 'restart') {
      expect(server.httpServer).not.toBe(originalHttpServer)
      expect(originalHttpServer?.listening).toBe(false)
    }
    else {
      expect(server.httpServer).toBe(originalHttpServer)
      expect(fixture.servers[1]!.httpServer?.listening).toBe(false)
    }

    const url = server.resolvedUrls?.local[0]
    if (!url) {
      throw new Error('Dashboard lost its active host')
    }
    const page = await fetch(url)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<main>Owned Dashboard host</main>')
    await handle.update(analyzeResult('after replacement'), new Map())
    client = new Client({ name: 'dashboard-lifecycle-test', version: '1' }, {
      supportedProtocolVersions: ['2025-11-25'],
      versionNegotiation: { mode: 'legacy' },
    })
    await client.connect(new StreamableHTTPClientTransport(new URL('__mcp', url), {
      requestInit: { headers: { Origin: new URL(url).origin } },
    }))
    expect(await client.callTool({ name: 'weapp-vite_get-dashboard-state' })).toMatchObject({
      structuredContent: { revision: 1 },
    })
    await client.close()
    client = undefined

    await handle.close()
    await handle.waitForExit()
    expect(exited).toHaveBeenCalledOnce()
    expect(server.httpServer?.listening).toBe(false)
    expect(await fs.readdir(path.join(fixture.root, 'instances'))).toEqual([])
    await expect(fetch(url)).rejects.toThrow()
  }
  finally {
    try {
      await client?.close()
    }
    finally {
      await scope.close()
    }
  }
})
