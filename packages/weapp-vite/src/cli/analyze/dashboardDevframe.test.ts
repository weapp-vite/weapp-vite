import type { AnalyzeSubpackagesResult, PackageFileEntry } from '../../analyze/subpackages'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { initDevframe } from 'devframe/initiate'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createAnalyzeDashboardDevframe,
  createDashboardFileReader,
  MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS,
  MAX_DASHBOARD_FILE_CONTENT_BYTES,
  readDashboardFileContent,
} from './dashboardDevframe'

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

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('dashboard Devframe protocol', () => {
  it('registers paged analyze queries without writable shared state', async () => {
    const current = createAnalyzeResult()
    const next = createAnalyzeResult()
    next.packages[0]!.label = 'x'.repeat(MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS + 16)
    const snapshot = {
      current,
      previous: null as AnalyzeSubpackagesResult | null,
    }
    const runtimeEvents: unknown[] = [{ id: 'initial' }]
    const controller = createAnalyzeDashboardDevframe({
      getAnalyzeSnapshot: () => snapshot,
      getRuntimeEvents: () => runtimeEvents,
      roots: {},
    })
    const instance = initDevframe(controller.definition, {
      auth: false,
      base: '/',
      sse: false,
      ws: false,
    })

    try {
      await instance.ready
      const context = await instance.context
      const dashboard = context.scope('weapp-vite')
      const initialState = await dashboard.rpc.call('get-dashboard-state')
      expect(initialState).toMatchObject({
        revision: 0,
        runtimeEvents: [{ id: 'initial' }],
        analyze: {
          current: { pages: 1 },
          previous: null,
        },
      })
      expect(context.rpc.sharedState.keys()).not.toContain('weapp-vite:dashboard')
      await expect(dashboard.rpc.call(
        'devframe:rpc:server-state:set',
        'weapp-vite:dashboard',
        { revision: 999 },
        'malicious-set',
      )).rejects.toThrow('只允许服务端修改')
      await expect(dashboard.rpc.call(
        'devframe:rpc:server-state:patch',
        'weapp-vite:dashboard',
        [{ op: 'replace', path: ['revision'], value: 999 }],
        'malicious-patch',
      )).rejects.toThrow('只允许服务端修改')

      snapshot.previous = current
      snapshot.current = next
      runtimeEvents.unshift({ id: 'next' })
      controller.syncRuntimeEvents()
      controller.notifyAnalyzeUpdate()

      const nextState = await dashboard.rpc.call('get-dashboard-state')
      expect(nextState.revision).toBe(1)
      expect(nextState.runtimeEvents).toEqual([{ id: 'next' }, { id: 'initial' }])
      expect(nextState.analyze.current.pages).toBeGreaterThan(1)
      expect(nextState.analyze.previous).toMatchObject({ pages: 1 })

      const content: string[] = []
      for (let index = 0; index < nextState.analyze.current.pages; index++) {
        const page = await dashboard.rpc.call('get-analyze-page', {
          index,
          revision: nextState.revision,
          target: 'current',
        })
        expect(page.content.length).toBeLessThanOrEqual(MAX_DASHBOARD_ANALYZE_PAGE_CHARACTERS)
        content.push(page.content)
      }
      expect(JSON.parse(content.join(''))).toEqual(next)
      await expect(dashboard.rpc.call('get-analyze-page', {
        index: 0,
        revision: 0,
        target: 'current',
      })).rejects.toThrow('Analyze revision')
    }
    finally {
      await instance.close()
    }
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
      artifactRoot: project.artifactRoot,
      projectRoot: project.projectRoot,
      srcRoot: path.join(project.projectRoot, 'src'),
    }

    await expect(readDashboardFileContent({ kind: 'source', path: 'src/pages/index.ts' }, roots, result)).resolves.toMatchObject({
      kind: 'source',
      language: 'typescript',
      path: 'src/pages/index.ts',
      content: 'export const page = true\n',
    })
    await expect(readDashboardFileContent({ kind: 'source', path: 'app.ts' }, roots, result)).resolves.toMatchObject({
      kind: 'source',
      language: 'typescript',
      path: 'app.ts',
      content: 'export const app = true\n',
    })
    await expect(readDashboardFileContent({
      kind: 'source',
      path: '../../packages-runtime/wevu/dist/src.mjs',
    }, roots, result)).resolves.toMatchObject({
      kind: 'source',
      language: 'javascript',
      path: '../../packages-runtime/wevu/dist/src.mjs',
      content: 'export const runtime = true\n',
    })
    await expect(readDashboardFileContent({
      kind: 'artifact',
      path: 'pages/index/index.js',
    }, roots, result)).resolves.toMatchObject({
      kind: 'artifact',
      language: 'javascript',
      path: 'pages/index/index.js',
      content: 'Page({})\n',
    })
    await expect(readDashboardFileContent({
      kind: 'source',
      path: '../secret.txt',
    }, roots, result)).rejects.toThrow('必须传入合法的 kind 和相对路径。')
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
    }, result)).resolves.toMatchObject({
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
    }, result)).resolves.toMatchObject({
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
    }, result)).rejects.toThrow('必须传入合法的 kind 和相对路径。')
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
    }, result)).rejects.toThrow('源码路径存在多个候选文件，已拒绝读取。')
  })

  it('caches the allowlist until the analyze revision changes', async () => {
    const project = await createTemporaryProject()
    const result = createAnalyzeResult([
      {
        file: 'pages/index/index.js',
        type: 'chunk',
        from: 'main',
      },
    ])
    const reader = createDashboardFileReader({
      artifactRoot: project.artifactRoot,
    }, result)

    await expect(reader.read({
      kind: 'artifact',
      path: 'pages/index/index.js',
    })).resolves.toMatchObject({ content: 'Page({})\n' })
    result.packages = []
    await expect(reader.read({
      kind: 'artifact',
      path: 'pages/index/index.js',
    })).resolves.toMatchObject({ content: 'Page({})\n' })

    reader.update(result)
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
    }, result)).rejects.toThrow('文件路径包含不允许的符号链接。')
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
    }, result)).rejects.toThrow(`文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节`)
  })
})
