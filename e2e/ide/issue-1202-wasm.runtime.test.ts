import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src/runtime'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const ROUTE = '/pages/index/index'
const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1202'

async function getReachableWasmReferences(dist: string, entry: string) {
  const pending = [entry]
  const visited = new Set<string>()
  const references = new Set<string>()

  while (pending.length > 0) {
    const script = pending.pop()!
    if (visited.has(script)) {
      continue
    }
    visited.add(script)
    const code = await readFile(path.join(dist, script), 'utf8')
    for (const match of code.matchAll(/\/[^"'\s]+\.wasm/g)) {
      references.add(match[0])
    }
    for (const match of code.matchAll(/require\(["']([^"']+\.js)["']\)/g)) {
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(script), match[1]!))
      if (dependency.startsWith('../') || dependency.startsWith('/')) {
        continue
      }
      pending.push(dependency)
    }
  }

  return [...references]
}

async function findEmittedWasmReference(dist: string, references: string[], matches: (reference: string) => boolean) {
  for (const reference of references) {
    if (!reference.startsWith('/') || !matches(reference)) {
      continue
    }
    try {
      await access(path.join(dist, reference.slice(1)))
      return reference
    }
    catch {
      continue
    }
  }
  return undefined
}

describe('issue #1202: WXWebAssembly ?init runtime', () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let errors: RuntimeErrorCollector | undefined
  let buildFailed = false

  beforeAll(async () => {
    project = await createIssueRegressionProject(1202)
    try {
      await buildIssueRegressionProject(project, 'weapp')
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, 'dist', `${ROUTE}.${extension}`))
      }
      const dist = path.join(project, 'dist')
      const app = JSON.parse(await readFile(path.join(dist, 'app.json'), 'utf8')) as { pages: string[] }
      expect(app.pages).toContain(ROUTE.slice(1))
      const mainWasmReferences = await getReachableWasmReferences(dist, 'pages/index/index.js')
      const wasmPath = await findEmittedWasmReference(dist, mainWasmReferences, () => true)
      expect(wasmPath).toBeTruthy()
      for (const [scope, entry] of [
        ['workers', 'workers/index.js'],
        ['regular', 'regular/pages/engine/index.js'],
        ['isolated', 'isolated/pages/engine/index.js'],
      ] as const) {
        const references = await getReachableWasmReferences(dist, entry)
        const reference = await findEmittedWasmReference(dist, references, (candidate) => {
          if (scope === 'isolated') {
            return candidate.startsWith('/isolated/')
          }
          if (scope === 'workers') {
            return !candidate.startsWith('/workers/')
          }
          return candidate === wasmPath
        })
        expect(reference, `${scope} bundle should reference its emitted WASM`).toBeTruthy()
        await access(path.join(dist, reference!.slice(1)))
        if (scope === 'isolated') {
          expect(reference).toMatch(/^\/isolated\//)
        }
        else {
          expect(reference).not.toMatch(/^\/(?:regular|workers)\//)
        }
      }

      const simulator = createHeadlessSession({ projectPath: project })
      try {
        simulator.reLaunch(ROUTE)
        expect(await simulator.evaluateRuntime<Promise<unknown>>('() => getCurrentPages()[0].run()')).toEqual({ value: 42 })
        expect(await simulator.evaluateRuntime<Promise<unknown>>('() => getCurrentPages()[0].runWorker()')).toEqual({ value: 42 })
        expect(simulator.renderCurrentPage().wxml).toContain('42')
        for (const route of ['/regular/pages/engine/index', '/isolated/pages/engine/index']) {
          simulator.reLaunch(route)
          expect(await simulator.evaluateRuntime<Promise<unknown>>('() => getCurrentPages()[0].run()')).toEqual({ value: 42 })
        }
      }
      finally {
        simulator.close()
      }
    }
    catch (error) {
      buildFailed = true
      process.stdout.write(`[issue-1202] retained failed project: ${path.relative(process.cwd(), project).split(path.sep).join('/')}\n`)
      await writeFile(path.join(project, 'failure.log'), String(error))
      throw error
    }

    host = await launchAutomator({
      projectPath: project,
      trustProject: true,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue1202-page'],
    })
    errors = attachRuntimeErrorCollector(host)
  }, 480_000)

  afterEach(() => {
    expect(errors?.getAll()).toEqual([])
  })

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project: buildFailed ? undefined : project,
      disposeTransport: () => errors?.dispose(),
      closeSession: () => host?.close(),
      stopDev: () => {},
    })
  }, 120_000)

  it('initializes a real packaged module on the main thread', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'ready', route: ROUTE, action: '加载主包页面与包内 WASM', nodes: [{ selector: '#wasm-status', text: 'ready' }, { selector: '#wasm-value', text: 'none' }] },
      { id: 'initialized', route: ROUTE, action: '调用 Vite 标准 ?init 初始化器并执行 add 导出', nodes: [{ selector: '#wasm-status', text: 'loaded' }, { selector: '#wasm-value', text: '42' }] },
    ])
    const page = await host!.currentPage()
    await dom.check('ready', host!, page)
    expect(await page.callMethodWithOptions('run')).toEqual({ value: 42 })
    await dom.check('initialized', host!, page)
    expect(await page.callMethodWithOptions('runWorker')).toEqual({ value: 42 })

    for (const [route, method] of [
      ['/regular/pages/engine/index', 'run'],
      ['/isolated/pages/engine/index', 'run'],
    ] as const) {
      const packagePage = await host!.reLaunch(route)
      expect(await packagePage.callMethodWithOptions(method)).toEqual({ value: 42 })
    }
  })
})
