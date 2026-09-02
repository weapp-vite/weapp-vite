import type { AnalyzeSubpackagesResult, PackageFileEntry } from '../../analyze/subpackages'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { initDevframe } from 'devframe/initiate'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createAnalyzeDashboardDevframe,
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
  it('registers analyze query and revision-based shared state', async () => {
    const current = createAnalyzeResult()
    const next = createAnalyzeResult()
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
      const dashboard = (await instance.context).scope('weapp-vite')
      await expect(dashboard.rpc.call('get-analyze-state')).resolves.toEqual(snapshot)
      const sharedState = await dashboard.rpc.sharedState('dashboard')
      expect(sharedState.value()).toMatchObject({
        revision: 0,
        runtimeEvents: [{ id: 'initial' }],
      })

      snapshot.previous = current
      snapshot.current = next
      runtimeEvents.unshift({ id: 'next' })
      controller.syncRuntimeEvents()
      controller.notifyAnalyzeUpdate()

      expect(sharedState.value()).toMatchObject({
        revision: 1,
        runtimeEvents: [{ id: 'next' }, { id: 'initial' }],
      })
      await expect(dashboard.rpc.call('get-analyze-state')).resolves.toEqual(snapshot)
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
      sourceRoot: project.projectRoot,
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
      sourceRoot: project.projectRoot,
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
      sourceRoot: project.projectRoot,
    }, result)).rejects.toThrow('源码路径存在多个候选文件，已拒绝读取。')
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
      sourceRoot: project.projectRoot,
    }, result)).rejects.toThrow(`文件超过 ${MAX_DASHBOARD_FILE_CONTENT_BYTES} 字节`)
  })
})
