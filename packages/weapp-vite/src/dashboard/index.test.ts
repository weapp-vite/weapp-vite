import type { DevframeInstance } from 'devframe/initiate'
import type { AnalyzeSubpackagesResult, PackageFileEntry } from '../analyze/subpackages'
import type { DashboardRuntimeEventProfile } from './events'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createMcpFetchHandler } from '@devframes/agentic/mcp'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { initDevframe } from 'devframe/initiate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDashboardArtifactSnapshot, MAX_DASHBOARD_ARTIFACT_CONTENT_BYTES, MAX_DASHBOARD_FILE_CONTENT_BYTES } from './artifacts'
import { createDashboardFileReader, readDashboardFileContent } from './content'
import { createAnalyzeDashboardDevframe } from './index'
import { MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS } from './payload'

const temporaryRoots: string[] = []

function createAnalyzeResult(files: PackageFileEntry[] = []): AnalyzeSubpackagesResult {
  return {
    packages: [
      {
        id: 'main',
        label: 'main',
        type: 'main',
        files,
      },
    ],
    modules: [],
    subPackages: [],
    glassEasel: {
      detected: false,
      minimumBaseLibrary: '3.8.12',
      migrationGuide: '',
      diagnostics: [],
      summary: {
        errors: 0,
        warnings: 0,
      },
    },
  }
}

async function createTemporaryProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-dashboard-devframe-'))
  temporaryRoots.push(root)
  const projectRoot = path.join(root, 'apps', 'lab')
  const sourceFile = path.join(projectRoot, 'src', 'pages', 'index.ts')
  const srcRootFile = path.join(projectRoot, 'src', 'app.ts')
  const artifactFile = path.join(projectRoot, 'dist', 'pages', 'index', 'index.js')
  const workspaceFile = path.join(root, 'packages-runtime', 'wevu', 'dist', 'src.mjs')
  await fs.mkdir(path.dirname(sourceFile), { recursive: true })
  await fs.mkdir(path.dirname(artifactFile), { recursive: true })
  await fs.mkdir(path.dirname(workspaceFile), { recursive: true })
  await fs.writeFile(sourceFile, 'export const page = true\n', 'utf8')
  await fs.writeFile(srcRootFile, 'export const app = true\n', 'utf8')
  await fs.writeFile(artifactFile, 'Page({})\n', 'utf8')
  await fs.writeFile(workspaceFile, 'export const runtime = true\n', 'utf8')
  return {
    artifactRoot: path.join(projectRoot, 'dist'),
    projectRoot,
    sourceFile,
    workspaceFile,
  }
}

async function connectDashboardMcp(instance: DevframeInstance) {
  await instance.ready
  const handler = createMcpFetchHandler(await instance.context, {
    serverName: 'dashboard-test',
    serverVersion: '1.0.0',
    exposeSharedState: false,
    authorization: 'dashboard-test-token',
  })
  const client = new Client({ name: 'dashboard-test', version: '1.0.0' })
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost/__mcp'), {
      requestInit: {
        headers: { Origin: 'http://localhost', Authorization: 'Bearer dashboard-test-token' },
      },
      fetch: (input, init) => handler.fetch(new Request(input, init)),
    }))
  }
  catch (error) {
    await client.close()
    await handler.dispose()
    throw error
  }
  return {
    client,
    async close() {
      await client.close()
      await handler.dispose()
    },
  }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('dashboard Devframe protocol', () => {
  it('publishes one coherent report revision and preserves foreign shared-state writes', async () => {
    const current = createAnalyzeResult()
    const next = createAnalyzeResult([{ file: 'app.js', type: 'chunk', from: 'main' }])
    next.packages[0]!.label = 'x'.repeat(MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS + 16)
    const controller = createAnalyzeDashboardDevframe({
      snapshot: { current, previous: null, artifacts: new Map() },
      initialEvents: [{ kind: 'command', level: 'info', title: 'initial', detail: 'session' }],
      roots: {},
    })
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false })
    try {
      await instance.ready
      const context = await instance.context
      const dashboard = context.scope('weapp-vite')
      const foreign = await context.scope('foreign').rpc.sharedState('counter', { initialValue: { count: 0 } })
      await dashboard.rpc.call('devframe:rpc:server-state:set', 'foreign:counter', { count: 1 }, 'set')
      await dashboard.rpc.call('devframe:rpc:server-state:patch', 'foreign:counter', [{ op: 'replace', path: ['count'], value: 2 }], 'patch')
      expect(foreign.value()).toEqual({ count: 2 })
      await dashboard.rpc.call('devframe:rpc:server-state:set', 'weapp-vite:dashboard', { revision: 999 }, 'unrelated-state')
      const initialState = await dashboard.rpc.call('get-dashboard-state')
      expect(initialState).toMatchObject({
        revision: 0,
        runtimeEvents: [{ title: 'initial' }],
        analyze: { current: { pages: 1 }, previous: null },
      })

      const broadcast = vi.spyOn(context.rpc, 'broadcast')
      const artifacts = createDashboardArtifactSnapshot()
      artifacts.capture('app.js', 'new artifact')
      await controller.update(next, artifacts.files)
      const publications = broadcast.mock.calls.filter(([options]) => options.method === 'weapp-vite:dashboard-state-updated')
      expect(publications).toHaveLength(1)
      const nextState = await dashboard.rpc.call('get-dashboard-state')
      expect(publications[0]?.[0].args).toEqual([nextState])
      expect(nextState.revision).toBe(1)
      expect(nextState.runtimeEvents.map(event => event.kind)).toEqual(['build', 'command'])
      expect(nextState.analyze.previous).toEqual(initialState.analyze.current)
      await expect(dashboard.rpc.call('read-dashboard-file', { kind: 'artifact', path: 'app.js', revision: 1 }))
        .resolves
        .toMatchObject({ content: 'new artifact' })

      const content: string[] = []
      for (let index = 0; index < nextState.analyze.current.pages; index++) {
        const page = await dashboard.rpc.call('get-analyze-page', { index, revision: 1, target: 'current' })
        expect(page.descriptor).toEqual(nextState.analyze.current)
        expect(page.content.length).toBeLessThanOrEqual(MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS)
        content.push(page.content)
      }
      expect(JSON.parse(content.join(''))).toEqual(next)
      const previous = await dashboard.rpc.call('get-analyze-page', { index: 0, revision: 1, target: 'previous' })
      expect(JSON.parse(previous.content)).toEqual(current)
      await expect(dashboard.rpc.call('get-analyze-page', { index: 0, revision: 0, target: 'current' })).rejects.toThrow('Analyze revision')
      await expect(dashboard.rpc.call('get-analyze-page', { index: nextState.analyze.current.pages, revision: 1, target: 'current' })).rejects.toThrow('分页不存在')
      await expect(dashboard.rpc.call('get-analyze-page', { index: -1, revision: 1, target: 'current' })).rejects.toThrow()

      controller.emitRuntimeEvents([{ kind: 'system', level: 'warning', title: 'warning', detail: 'event only' }])
      const eventState = await dashboard.rpc.call('get-dashboard-state')
      expect(eventState.revision).toBe(1)
      expect(eventState.analyze).toEqual(nextState.analyze)
      expect(eventState.runtimeEvents.map(event => event.kind)).toEqual(['system', 'build', 'command'])
      controller.dispose()
      controller.dispose()
      broadcast.mockClear()
      controller.emitRuntimeEvents([{ kind: 'system', level: 'info', title: 'closed', detail: '' }])
      await controller.update(current, new Map())
      expect(broadcast).not.toHaveBeenCalled()
      expect(artifacts.files.get('app.js')?.content).toBe('new artifact')
      await expect(dashboard.rpc.call('get-dashboard-state')).rejects.toThrow('Analyze revision')
      await expect(dashboard.rpc.call('get-analyze-page', { index: 0, revision: 1, target: 'current' })).rejects.toThrow('Analyze revision')
    }
    finally {
      vi.restoreAllMocks()
      controller.dispose()
      await instance.close()
    }
  })

  it('retains bounded events and pre-mount report updates without changing revisions for events', async () => {
    const initial = createAnalyzeResult()
    const next = createAnalyzeResult([{ file: 'next.js', type: 'chunk', from: 'main' }])
    const previous = createAnalyzeResult([{ file: 'previous.js', type: 'chunk', from: 'main' }])
    const controller = createAnalyzeDashboardDevframe({
      snapshot: { current: initial, previous: null, artifacts: new Map() },
      roots: {},
    })
    await controller.update(next, new Map(), previous)
    controller.emitRuntimeEvents(Array.from({ length: 30 }, (_, index) => ({
      kind: 'system',
      level: 'info',
      title: `event-${index}`,
      detail: '',
    })))
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false })
    try {
      await instance.ready
      const dashboard = (await instance.context).scope('weapp-vite')
      const state = await dashboard.rpc.call('get-dashboard-state')
      expect(state.revision).toBe(1)
      expect(state.runtimeEvents.map(event => event.title)).toEqual(Array.from({ length: 24 }, (_, index) => `event-${index}`))
      const page = await dashboard.rpc.call('get-analyze-page', { index: 0, revision: 1, target: 'previous' })
      expect(JSON.parse(page.content)).toEqual(previous)
    }
    finally {
      controller.dispose()
      await instance.close()
    }
  })

  it.each(['update', 'dispose'] as const)('rejects obsolete in-flight reads after %s without clearing caller artifacts', async (transition) => {
    const project = await createTemporaryProject()
    const result = createAnalyzeResult([{
      file: 'analysis-only.js',
      type: 'chunk',
      from: 'main',
      source: 'app.ts',
      sourceType: 'src',
    }])
    const initialArtifacts = createDashboardArtifactSnapshot()
    initialArtifacts.capture('analysis-only.js', 'initial analysis bytes')
    const snapshot = { current: result, previous: null, artifacts: initialArtifacts.files }
    const controller = createAnalyzeDashboardDevframe({
      snapshot,
      roots: { srcRoot: path.join(project.projectRoot, 'src') },
    })
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
    const mcp = await connectDashboardMcp(instance)
    let releaseRead: (() => void) | undefined
    try {
      await instance.ready
      const dashboard = (await instance.context).scope('weapp-vite')
      await expect(dashboard.rpc.call('read-dashboard-file', {
        kind: 'artifact',
        path: 'analysis-only.js',
        revision: 0,
      })).resolves.toMatchObject({ content: 'initial analysis bytes' })

      const originalOpen = fs.open
      const readGate = new Promise<void>((resolve) => {
        releaseRead = resolve
      })
      let markReadStarted!: () => void
      const readStarted = new Promise<void>((resolve) => {
        markReadStarted = resolve
      })
      let startedReads = 0
      vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
        if (++startedReads === 2) {
          markReadStarted()
        }
        await readGate
        return await originalOpen(...args)
      })
      const pendingRead = dashboard.rpc.call('read-dashboard-file', {
        kind: 'source',
        path: 'app.ts',
        revision: 0,
      })
      const rejectedRead = expect(pendingRead).rejects.toThrow()
      const rejectedMcpRead = expect(mcp.client.callTool({
        name: 'weapp-vite_read-dashboard-file',
        arguments: { arg0: { kind: 'source', path: 'app.ts', revision: 0 } },
      })).resolves.toMatchObject({ isError: true })
      await readStarted
      if (transition === 'dispose') {
        controller.dispose()
        releaseRead()
        await Promise.all([rejectedRead, rejectedMcpRead])
        expect(initialArtifacts.files.get('analysis-only.js')?.content).toBe('initial analysis bytes')
        await expect(dashboard.rpc.call('read-dashboard-file', {
          kind: 'artifact',
          path: 'analysis-only.js',
          revision: 0,
        })).rejects.toThrow()
        return
      }
      const nextArtifacts = createDashboardArtifactSnapshot()
      nextArtifacts.capture('analysis-only.js', 'updated analysis bytes')
      await controller.update(result, nextArtifacts.files)
      releaseRead()
      await Promise.all([rejectedRead, rejectedMcpRead])

      await expect(dashboard.rpc.call('read-dashboard-file', {
        kind: 'artifact',
        path: 'analysis-only.js',
        revision: 0,
      })).rejects.toThrow()
      await expect(dashboard.rpc.call('read-dashboard-file', {
        kind: 'artifact',
        path: 'analysis-only.js',
        revision: 1,
      })).resolves.toMatchObject({ content: 'updated analysis bytes' })
      await fs.writeFile(path.join(project.artifactRoot, 'analysis-only.js'), 'stale disk bytes')
      await controller.update(result, new Map())
      await expect(dashboard.rpc.call('read-dashboard-file', {
        kind: 'artifact',
        path: 'analysis-only.js',
        revision: 2,
      })).rejects.toThrow()
      controller.dispose()
      await expect(dashboard.rpc.call('read-dashboard-file', {
        kind: 'source',
        path: 'app.ts',
        revision: 2,
      })).rejects.toThrow()
    }
    finally {
      releaseRead?.()
      vi.restoreAllMocks()
      await mcp.close()
      controller.dispose()
      await instance.close()
    }
  })

  it('enforces artifact byte limits and freezes binary contents without expanding the allowlist', async () => {
    const artifacts = createDashboardArtifactSnapshot()
    const bytes = Buffer.from('快照', 'utf8')
    artifacts.capture('independent/asset.txt', bytes)
    bytes.fill(0)
    const files: PackageFileEntry[] = [{ file: 'independent/asset.txt', type: 'asset', from: 'independent' }]
    const limitContent = 'x'.repeat(MAX_DASHBOARD_FILE_CONTENT_BYTES)
    const count = MAX_DASHBOARD_ARTIFACT_CONTENT_BYTES / MAX_DASHBOARD_FILE_CONTENT_BYTES
    for (let index = 0; index <= count; index++) {
      const file = `chunks/${index}.js`
      artifacts.capture(file, limitContent)
      files.push({ file, type: 'chunk', from: 'main' })
    }
    artifacts.capture('oversized.js', `${limitContent}x`)
    files.push({ file: 'oversized.js', type: 'chunk', from: 'main' })
    artifacts.capture('not-in-report.js', 'hidden')
    const reader = createDashboardFileReader({}, createAnalyzeResult(files), artifacts.files)
    await expect(reader.read({ kind: 'artifact', path: 'independent/asset.txt' })).resolves.toMatchObject({
      content: '快照',
      size: 6,
    })
    await expect(reader.read({ kind: 'artifact', path: 'chunks/0.js' })).resolves.toMatchObject({
      content: limitContent,
      size: MAX_DASHBOARD_FILE_CONTENT_BYTES,
    })
    await expect(reader.read({ kind: 'artifact', path: `chunks/${count}.js` })).rejects.toThrow('快照容量上限')
    await expect(reader.read({ kind: 'artifact', path: 'oversized.js' })).rejects.toThrow('文件超过')
    await expect(reader.read({ kind: 'artifact', path: 'not-in-report.js' })).rejects.toThrow('合法的 kind 和相对路径')
    reader.dispose()
    await expect(reader.read({ kind: 'artifact', path: 'chunks/0.js' })).rejects.toThrow('会话已关闭')
  })

  it('reads only source and artifact paths present in the analyze result', async () => {
    const project = await createTemporaryProject()
    const result = createAnalyzeResult([
      {
        file: 'pages/index/index.js',
        type: 'chunk',
        from: 'main',
        modules: [
          {
            id: 'src/pages/index.ts',
            source: 'src/pages/index.ts',
            sourceType: 'src',
          },
          {
            id: 'app.ts',
            source: 'app.ts',
            sourceType: 'src',
          },
          {
            id: '../../packages-runtime/wevu/dist/src.mjs',
            source: '../../packages-runtime/wevu/dist/src.mjs',
            sourceType: 'workspace',
          },
        ],
      },
    ])
    const roots = {
      projectRoot: project.projectRoot,
      srcRoot: path.join(project.projectRoot, 'src'),
    }
    const artifacts = createDashboardArtifactSnapshot()
    artifacts.capture('pages/index/index.js', 'Page({ snapshot: true })\n')

    await expect(readDashboardFileContent({ kind: 'source', path: 'src/pages/index.ts' }, roots, result, new Map())).resolves.toMatchObject({
      kind: 'source',
      language: 'typescript',
      path: 'src/pages/index.ts',
      content: 'export const page = true\n',
    })
    await expect(readDashboardFileContent({ kind: 'source', path: 'app.ts' }, roots, result, new Map())).resolves.toMatchObject({
      kind: 'source',
      language: 'typescript',
      path: 'app.ts',
      content: 'export const app = true\n',
    })
    await expect(readDashboardFileContent({
      kind: 'source',
      path: '../../packages-runtime/wevu/dist/src.mjs',
    }, roots, result, new Map())).resolves.toMatchObject({
      kind: 'source',
      language: 'javascript',
      path: '../../packages-runtime/wevu/dist/src.mjs',
      content: 'export const runtime = true\n',
    })
    await expect(readDashboardFileContent({
      kind: 'artifact',
      path: 'pages/index/index.js',
    }, roots, result, artifacts.files)).resolves.toMatchObject({
      kind: 'artifact',
      language: 'javascript',
      path: 'pages/index/index.js',
      content: 'Page({ snapshot: true })\n',
    })
    await expect(readDashboardFileContent({
      kind: 'source',
      path: '../secret.txt',
    }, roots, result, new Map())).rejects.toThrow('必须传入合法的 kind 和相对路径。')
  })
  it('resolves source files from a configured non-default srcRoot', async () => {
    const project = await createTemporaryProject()
    const customSrcRoot = path.join(project.projectRoot, 'miniprogram')
    await fs.mkdir(customSrcRoot, { recursive: true })
    await fs.writeFile(path.join(customSrcRoot, 'app.ts'), 'export const customApp = true\n', 'utf8')
    const result = createAnalyzeResult([
      {
        file: 'app.js',
        type: 'chunk',
        from: 'main',
        modules: [
          {
            id: 'app.ts',
            source: 'app.ts',
            sourceType: 'src',
          },
        ],
      },
    ])

    await expect(readDashboardFileContent({
      kind: 'source',
      path: 'app.ts',
    }, {
      projectRoot: project.projectRoot,
      srcRoot: customSrcRoot,
    }, result, new Map())).resolves.toMatchObject({
      path: 'app.ts',
      content: 'export const customApp = true\n',
    })
  })

  it('resolves plugin files from an external configured pluginRoot', async () => {
    const project = await createTemporaryProject()
    const pluginRoot = path.resolve(project.projectRoot, '..', '..', 'plugin-root')
    const pluginFile = path.join(pluginRoot, 'components', 'plugin.ts')
    await fs.mkdir(path.dirname(pluginFile), { recursive: true })
    await fs.writeFile(pluginFile, 'export const plugin = true\n', 'utf8')
    const result = createAnalyzeResult([
      {
        file: 'plugin.js',
        type: 'asset',
        from: 'main',
        source: 'plugin-root/components/plugin.ts',
        sourceType: 'plugin',
      },
    ])

    await expect(readDashboardFileContent({
      kind: 'source',
      path: 'plugin-root/components/plugin.ts',
    }, {
      pluginRoot,
      projectRoot: project.projectRoot,
      srcRoot: path.join(project.projectRoot, 'src'),
    }, result, new Map())).resolves.toMatchObject({
      path: 'plugin-root/components/plugin.ts',
      content: 'export const plugin = true\n',
    })
  })

  it('rejects a source path with ambiguous semantic roots', async () => {
    const project = await createTemporaryProject()
    await fs.writeFile(path.join(project.projectRoot, 'app.ts'), 'export const projectApp = true\n', 'utf8')
    const result = createAnalyzeResult([
      {
        file: 'app.js',
        type: 'chunk',
        from: 'main',
        modules: [
          {
            id: 'src/app.ts',
            source: 'app.ts',
            sourceType: 'src',
          },
          {
            id: 'workspace/app.ts',
            source: 'app.ts',
            sourceType: 'workspace',
          },
        ],
      },
    ])

    await expect(readDashboardFileContent({
      kind: 'source',
      path: 'app.ts',
    }, {
      projectRoot: project.projectRoot,
      srcRoot: path.join(project.projectRoot, 'src'),
    }, result, new Map())).rejects.toThrow('必须传入合法的 kind 和相对路径。')
  })

  it('rejects an src-prefixed path when both source encodings exist', async () => {
    const project = await createTemporaryProject()
    const nestedSourceFile = path.join(project.projectRoot, 'src', 'src', 'app.ts')
    await fs.mkdir(path.dirname(nestedSourceFile), { recursive: true })
    await fs.writeFile(nestedSourceFile, 'export const nestedApp = true\n', 'utf8')
    const result = createAnalyzeResult([
      {
        file: 'app.js',
        type: 'chunk',
        from: 'main',
        modules: [
          {
            id: 'src/app.ts',
            source: 'src/app.ts',
            sourceType: 'src',
          },
        ],
      },
    ])

    await expect(readDashboardFileContent({
      kind: 'source',
      path: 'src/app.ts',
    }, {
      srcRoot: path.join(project.projectRoot, 'src'),
    }, result, new Map())).rejects.toThrow('源码路径存在多个候选文件，已拒绝读取。')
  })

  it('replaces the allowlist when a new report is published', async () => {
    const result = createAnalyzeResult([
      {
        file: 'pages/index/index.js',
        type: 'chunk',
        from: 'main',
      },
    ])
    const artifacts = createDashboardArtifactSnapshot()
    artifacts.capture('pages/index/index.js', 'Page({})\n')
    const reader = createDashboardFileReader({}, result, artifacts.files)

    await expect(reader.read({
      kind: 'artifact',
      path: 'pages/index/index.js',
    })).resolves.toMatchObject({ content: 'Page({})\n' })

    reader.update(createAnalyzeResult(), new Map())
    await expect(reader.read({
      kind: 'artifact',
      path: 'pages/index/index.js',
    })).rejects.toThrow('必须传入合法的 kind 和相对路径。')
  })

  it('rejects allowlisted files reached through a linked directory', async () => {
    const project = await createTemporaryProject()
    const outsideDirectory = path.resolve(project.projectRoot, '..', '..', 'outside')
    const linkedDirectory = path.resolve(project.projectRoot, 'src', 'linked')
    const outsideFile = path.resolve(outsideDirectory, 'secret.ts')
    await fs.mkdir(outsideDirectory, { recursive: true })
    await fs.writeFile(outsideFile, 'export const secret = true\n', 'utf8')
    await fs.symlink(
      outsideDirectory,
      linkedDirectory,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    const result = createAnalyzeResult([
      {
        file: 'app.js',
        type: 'chunk',
        from: 'main',
        modules: [{
          id: path.resolve(linkedDirectory, 'secret.ts'),
          source: 'linked/secret.ts',
          sourceType: 'src',
        }],
      },
    ])

    await expect(readDashboardFileContent({
      kind: 'source',
      path: 'linked/secret.ts',
    }, {
      projectRoot: project.projectRoot,
      srcRoot: path.resolve(project.projectRoot, 'src'),
    }, result, new Map())).rejects.toThrow('文件路径包含不允许的符号链接。')
  })

  it('rejects allowlisted files that exceed the content limit', async () => {
    const project = await createTemporaryProject()
    const oversizedFile = path.join(project.projectRoot, 'src', 'oversized.ts')
    await fs.writeFile(oversizedFile, Buffer.alloc(MAX_DASHBOARD_FILE_CONTENT_BYTES + 1))
    const result = createAnalyzeResult([
      {
        file: 'pages/index/index.js',
        type: 'chunk',
        from: 'main',
        modules: [
          {
            id: 'src/oversized.ts',
            source: 'src/oversized.ts',
            sourceType: 'src',
          },
        ],
      },
    ])

    await expect(readDashboardFileContent({
      kind: 'source',
      path: 'src/oversized.ts',
    }, {
      srcRoot: path.join(project.projectRoot, 'src'),
    }, result, new Map())).rejects.toThrow(`文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节`)
  })
})

describe('dashboard MCP capabilities', () => {
  it('discovers precisely the read-only schemas and shares live RPC results across revisions', async () => {
    const project = await createTemporaryProject()
    const current = createAnalyzeResult([{
      file: 'app.js',
      type: 'chunk',
      from: 'main',
      source: 'app.ts',
      sourceType: 'src',
    }])
    const artifacts = createDashboardArtifactSnapshot()
    artifacts.capture('app.js', 'initial artifact')
    const profile: Required<DashboardRuntimeEventProfile> = {
      timestamp: '2026-01-01T00:00:00Z',
      totalMs: 12,
      eventId: 'event-1',
      event: 'change',
      file: 'app.ts',
      relativeFile: 'src/app.ts',
      sourceRootFile: 'app.ts',
      buildCoreMs: 1,
      buildStartMs: 2,
      pluginResolveMs: 3,
      transformMs: 4,
      snapshotResolveMs: 5,
      snapshotBuildMs: 6,
      writeMs: 7,
      watchToDirtyMs: 8,
      emitMs: 9,
      sharedChunkResolveMs: 10,
      resolveCount: 11,
      dirtyCount: 12,
      pendingCount: 13,
      emittedCount: 14,
      dirtyReasonSummary: ['source changed'],
      pendingReasonSummary: ['dependent chunk'],
    }
    const controller = createAnalyzeDashboardDevframe({
      snapshot: { current, previous: null, artifacts: artifacts.files },
      roots: { srcRoot: path.join(project.projectRoot, 'src') },
      initialEvents: [{
        kind: 'hmr',
        level: 'success',
        title: 'profiled update',
        detail: 'app.ts',
        source: 'watcher',
        durationMs: 12,
        tags: ['hmr'],
        profile,
      }, { kind: 'system', level: 'info', title: 'ready', detail: '' }],
    })
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
    const mcp = await connectDashboardMcp(instance)
    try {
      const context = await instance.context
      const dashboard = context.scope('weapp-vite')
      const keys = [...context.rpc.sharedState.keys()]
      expect(keys).not.toContain('weapp-vite:dashboard')
      const { tools } = await mcp.client.listTools()
      expect(tools.map(tool => tool.name).sort()).toEqual([
        'weapp-vite_compare-analyze-builds',
        'weapp-vite_get-analyze-page',
        'weapp-vite_get-analyze-summary',
        'weapp-vite_get-dashboard-state',
        'weapp-vite_query-analyze-artifacts',
        'weapp-vite_query-analyze-modules',
        'weapp-vite_query-analyze-packages',
        'weapp-vite_query-runtime-events',
        'weapp-vite_read-dashboard-file',
      ])
      for (const tool of tools) {
        expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
        expect(tool.outputSchema).toMatchObject({ type: 'object' })
      }
      expect(tools.find(tool => tool.name === 'weapp-vite_get-dashboard-state')?.inputSchema)
        .toMatchObject({ type: 'object', properties: {} })
      expect(tools.find(tool => tool.name === 'weapp-vite_get-analyze-page')?.inputSchema)
        .toMatchObject({
          required: ['arg0'],
          properties: {
            arg0: {
              required: ['index', 'revision', 'target'],
              properties: {
                index: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
                revision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
                target: { enum: ['current', 'previous'] },
              },
            },
          },
        })
      expect(tools.find(tool => tool.name === 'weapp-vite_read-dashboard-file')?.inputSchema)
        .toMatchObject({
          required: ['arg0'],
          properties: {
            arg0: {
              required: ['kind', 'path', 'revision'],
              properties: { kind: { enum: ['source', 'artifact'] }, path: { type: 'string' } },
            },
          },
        })
      const state = await dashboard.rpc.call('get-dashboard-state')
      const mcpState = await mcp.client.callTool({ name: 'weapp-vite_get-dashboard-state' })
      expect(mcpState.isError).not.toBe(true)
      expect(mcpState.structuredContent).toEqual(JSON.parse(JSON.stringify(state)))
      expect(state.runtimeEvents[0]?.profile).toEqual(profile)
      for (const request of [
        { kind: 'source' as const, path: 'app.ts', revision: 0 },
        { kind: 'artifact' as const, path: 'app.js', revision: 0 },
      ]) {
        const file = await mcp.client.callTool({ name: 'weapp-vite_read-dashboard-file', arguments: { arg0: request } })
        expect(file.isError).not.toBe(true)
        expect(file.structuredContent).toEqual(await dashboard.rpc.call('read-dashboard-file', request))
      }
      const pageRequest = { index: 0, revision: 0, target: 'current' as const }
      const firstPage = await mcp.client.callTool({ name: 'weapp-vite_get-analyze-page', arguments: { arg0: pageRequest } })
      expect(firstPage.structuredContent).toEqual(await dashboard.rpc.call('get-analyze-page', pageRequest))
      expect(firstPage.structuredContent).toMatchObject({ content: JSON.stringify(current) })
      expect((await mcp.client.listResources()).resources).toEqual([])

      const next = createAnalyzeResult([{ file: 'next.js', type: 'chunk', from: 'main' }])
      next.packages[0]!.label = 'x'.repeat(MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS + 16)
      const nextArtifacts = createDashboardArtifactSnapshot()
      nextArtifacts.capture('next.js', 'next artifact')
      await controller.update(next, nextArtifacts.files)
      controller.emitRuntimeEvents([{ kind: 'diagnostic', level: 'warning', title: 'check', detail: 'after update' }])
      const nextState = await dashboard.rpc.call('get-dashboard-state')
      expect(nextState.revision).toBe(1)
      expect(nextState.analyze.previous).toEqual(state.analyze.current)
      expect((await mcp.client.callTool({ name: 'weapp-vite_get-dashboard-state' })).structuredContent)
        .toEqual(JSON.parse(JSON.stringify(nextState)))
      for (const target of ['current', 'previous'] as const) {
        const descriptor = nextState.analyze[target]!
        const content: string[] = []
        for (let index = 0; index < descriptor.pages; index++) {
          const request = { target, index, revision: 1 }
          const rpcPage = await dashboard.rpc.call('get-analyze-page', request)
          const mcpPage = await mcp.client.callTool({ name: 'weapp-vite_get-analyze-page', arguments: { arg0: request } })
          expect(mcpPage.structuredContent).toEqual(rpcPage)
          expect(rpcPage.content.length).toBeLessThanOrEqual(MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS)
          content.push(rpcPage.content)
        }
        expect(JSON.parse(content.join(''))).toEqual(target === 'current' ? next : current)
      }
      for (const [name, arg0] of [
        ['weapp-vite_get-analyze-page', pageRequest],
        ['weapp-vite_read-dashboard-file', { kind: 'artifact', path: 'app.js', revision: 0 }],
        ['weapp-vite_read-dashboard-file', { kind: 'artifact', path: 'app.js', revision: 1 }],
        ['weapp-vite_get-analyze-page', { index: nextState.analyze.current.pages, revision: 1, target: 'current' }],
      ] as const) {
        expect((await mcp.client.callTool({ name, arguments: { arg0 } })).isError).toBe(true)
      }
      const request = { kind: 'artifact' as const, path: 'next.js', revision: 1 }
      const file = await mcp.client.callTool({ name: 'weapp-vite_read-dashboard-file', arguments: { arg0: request } })
      expect(file.structuredContent).toEqual(await dashboard.rpc.call('read-dashboard-file', request))
      expect(file.structuredContent).toMatchObject({ content: 'next artifact' })
      expect([...context.rpc.sharedState.keys()]).toEqual(keys)
      expect(artifacts.files.get('app.js')?.content).toBe('initial artifact')
    }
    finally {
      await mcp.close()
      controller.dispose()
      await instance.close()
    }
  })

  it('rejects invalid tool arguments before file I/O and retains the authoritative file restrictions', async () => {
    const project = await createTemporaryProject()
    const sourceRoot = path.join(project.projectRoot, 'src')
    const outside = path.join(project.projectRoot, 'outside')
    await fs.mkdir(outside)
    await fs.writeFile(path.join(outside, 'secret.ts'), 'secret')
    await fs.symlink(outside, path.join(sourceRoot, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    await fs.writeFile(path.join(sourceRoot, 'oversized.ts'), Buffer.alloc(MAX_DASHBOARD_FILE_CONTENT_BYTES + 1))
    const current = createAnalyzeResult([{
      file: 'app.js',
      type: 'chunk',
      from: 'main',
      modules: ['app.ts', 'linked/secret.ts', 'oversized.ts'].map(source => ({ id: source, source, sourceType: 'src' as const })),
    }])
    const artifacts = createDashboardArtifactSnapshot()
    artifacts.capture('app.js', 'allowed')
    artifacts.capture('unlisted.js', 'unlisted secret')
    const controller = createAnalyzeDashboardDevframe({
      snapshot: { current, previous: null, artifacts: artifacts.files },
      roots: { srcRoot: sourceRoot },
    })
    const instance = initDevframe(controller.definition, { auth: false, base: '/', sse: false, ws: false, mcp: false })
    const mcp = await connectDashboardMcp(instance)
    try {
      const open = vi.spyOn(fs, 'open')
      for (const arg0 of [
        { kind: 'source', path: 'app.ts' },
        { kind: 'source', path: 'app.ts', revision: -1 },
        { kind: 'source', path: 'app.ts', revision: 0.5 },
        { kind: 'source', path: 'app.ts', revision: Number.MAX_SAFE_INTEGER + 1 },
        { kind: 'source', path: 12, revision: 0 },
        { kind: 'other', path: 'app.ts', revision: 0 },
      ]) {
        const result = await mcp.client.callTool({ name: 'weapp-vite_read-dashboard-file', arguments: { arg0 } })
        expect(result.isError).toBe(true)
        expect(result.structuredContent).toBeUndefined()
      }
      expect(open).not.toHaveBeenCalled()
      for (const arg0 of [
        { index: 0, target: 'current' },
        { index: -1, target: 'current', revision: 0 },
        { index: 0.5, target: 'current', revision: 0 },
        { index: Number.MAX_SAFE_INTEGER + 1, target: 'current', revision: 0 },
        { index: 0, target: 'other', revision: 0 },
        { index: 0, target: 'previous', revision: 0 },
      ]) {
        expect((await mcp.client.callTool({ name: 'weapp-vite_get-analyze-page', arguments: { arg0 } })).isError).toBe(true)
      }
      for (const arg0 of [
        { kind: 'source', path: '../outside/secret.ts', revision: 0 },
        { kind: 'source', path: project.sourceFile, revision: 0 },
        { kind: 'artifact', path: 'unlisted.js', revision: 0 },
        { kind: 'source', path: 'linked/secret.ts', revision: 0 },
        { kind: 'source', path: 'oversized.ts', revision: 0 },
      ]) {
        const result = await mcp.client.callTool({ name: 'weapp-vite_read-dashboard-file', arguments: { arg0 } })
        expect(result.isError).toBe(true)
        expect(result.structuredContent).toBeUndefined()
      }
      const file = await mcp.client.callTool({
        name: 'weapp-vite_read-dashboard-file',
        arguments: { arg0: { kind: 'source', path: 'app.ts', revision: 0 } },
      })
      expect(file.structuredContent).toMatchObject({ content: 'export const app = true\n' })
      expect((await mcp.client.callTool({ name: 'weapp-vite_get-dashboard-state' })).structuredContent)
        .toMatchObject({ revision: 0, runtimeEvents: [] })
    }
    finally {
      vi.restoreAllMocks()
      await mcp.close()
      controller.dispose()
      await instance.close()
    }
  })
})
