import type { AutomatorOptions, MiniProgramLike, ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import type { DomNodeExpectation } from '../utils/domAcceptance/types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  acquireSharedMiniProgram,
  closeSharedMiniProgram,
  queryWechatIdeLogin,
  releaseSharedMiniProgram,
  resolveAutomatorSessionOptions,
} from 'weapp-ide-cli'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { assertSelectedWechatDevtoolsRuntime, preflightSelectedWechatDevtools } from '../utils/devtoolsSelection'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TIMEOUT = 300_000
const fixtures = [
  { name: 'lifecycle-compare', routes: ['/pages/native/index', '/pages/blank/index'] },
  { name: 'auto-import-vue-sfc', routes: ['/pages/index/index', '/pages/native/index'] },
] as const

function autoImportNodes(includeAutoCard: boolean): DomNodeExpectation[] {
  return [
    { selector: '//*[@class="native-card"]', query: 'xpath', count: 2, text: 'native-card' },
    { selector: '//*[@class="card"]', query: 'xpath', ...(includeAutoCard ? { text: 'auto-card' } : { count: 0 }) },
  ]
}

async function buildFixture(fixture: typeof fixtures[number]) {
  const projectPath = path.resolve(import.meta.dirname, '../../e2e-apps', fixture.name)
  const config = JSON.parse(await fs.readFile(path.join(projectPath, 'project.config.json'), 'utf8')) as { appid?: unknown }
  expect(config.appid).toMatch(/^wx[\da-f]{16}$/)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: projectPath,
    platform: 'weapp',
    skipNpm: true,
    label: `ide:shared-host:${fixture.name}`,
  })
  for (const route of fixture.routes) {
    for (const extension of ['js', 'json', 'wxml']) {
      await fs.access(path.join(projectPath, 'dist', `${route.slice(1)}.${extension}`))
    }
  }
  return projectPath
}

describe('shared Stable host and project connection ownership', { concurrent: false }, () => {
  const runtimeProvider = resolveRuntimeProviderName()
  const options: AutomatorOptions[] = []
  let target: ResolvedWechatDevtoolsTarget | undefined

  async function assertLoggedIn() {
    if (target) {
      expect(await queryWechatIdeLogin(target.cliPath, { timeout: 15_000 })).toEqual({ status: 'success', login: true })
    }
  }

  async function acquireProject(index: number) {
    const selected = options[index]!
    const program = await acquireSharedMiniProgram(selected)
    if (target) {
      await assertSelectedWechatDevtoolsRuntime(target, program)
    }
    // 第二次调用走公开缓存入口，不注入已有连接，也不再次启动项目。
    const shared = await acquireSharedMiniProgram(selected)
    expect(shared).toBe(program)
    releaseSharedMiniProgram(selected.projectPath, selected.sessionId, selected)
    return program
  }

  async function disconnectProject(index: number) {
    const selected = options[index]
    if (selected) {
      releaseSharedMiniProgram(selected.projectPath, selected.sessionId, selected)
      await closeSharedMiniProgram(selected.projectPath, selected.sessionId, selected)
    }
  }

  beforeAll(async () => {
    if (runtimeProvider === 'devtools') {
      target = await preflightSelectedWechatDevtools()
      await assertLoggedIn()
    }
    for (const fixture of fixtures) {
      const projectPath = await buildFixture(fixture)
      options.push(await resolveAutomatorSessionOptions({
        projectPath,
        runtimeProvider,
        target,
        cliPath: target?.cliPath,
        sessionId: 'shared-host-regression',
        timeout: 60_000,
        trustProject: true,
        preserveProjectRoot: true,
        preferOpenedSession: false,
      }))
    }
  }, TIMEOUT)

  afterAll(async () => {
    // 只断开本 suite 创建的连接；不发 App.exit / Tool.close，不退出手动宿主或账号。
    for (let index = 0; index < options.length; index++) {
      await disconnectProject(index)
    }
    await assertLoggedIn()
  }, TIMEOUT)

  it('reuses each project connection and keeps the second project working after the first disconnects', async (context) => {
    const checkpoints = [
      { id: 'first-native', route: fixtures[0].routes[0], action: '启动并复用第一个项目连接', nodes: [{ selector: '#lifecycle-native-page .title', text: 'Native Page' }] },
      { id: 'first-blank', route: fixtures[0].routes[1], action: '第一个项目通过 reLaunch 切页', nodes: [{ selector: '.page', text: 'Blank Page' }] },
      { id: 'second-index', route: fixtures[1].routes[0], action: '保留第一个连接，顺序启动并复用第二个项目', nodes: autoImportNodes(true) },
      { id: 'second-native', route: fixtures[1].routes[1], action: '第二个项目通过 reLaunch 切页', nodes: autoImportNodes(false) },
      { id: 'second-after-disconnect', route: fixtures[1].routes[0], action: '重复释放第一个项目后第二个项目仍可导航和渲染', nodes: autoImportNodes(true) },
      ...(runtimeProvider === 'devtools'
        ? [{ id: 'second-reconnected', route: fixtures[1].routes[1], action: '仅重连已打开项目，不重启宿主，恢复导航和渲染', nodes: autoImportNodes(false) }]
        : []),
    ]
    const dom = createDomAcceptance(context, 'e2e-apps/lifecycle-compare + e2e-apps/auto-import-vue-sfc', checkpoints)
    async function navigate(id: string, program: MiniProgramLike, route: string) {
      const page = await program.reLaunch(route)
      expect(page.path.replace(/^\/+/, '')).toBe(route.slice(1))
      await dom.check(id, program, page)
    }

    // 两个不同项目各启动一次；每个项目内部只用 reLaunch 切换已有页面。
    const first = await acquireProject(0)
    await navigate('first-native', first, fixtures[0].routes[0])
    await navigate('first-blank', first, fixtures[0].routes[1])
    const second = await acquireProject(1)
    await navigate('second-index', second, fixtures[1].routes[0])
    await navigate('second-native', second, fixtures[1].routes[1])

    await disconnectProject(0)
    await disconnectProject(0)
    await navigate('second-after-disconnect', second, fixtures[1].routes[0])
    if (runtimeProvider === 'devtools') {
      await disconnectProject(1)
      const recovered = await acquireSharedMiniProgram({ ...options[1]!, preferOpenedSession: true, openedOnly: true })
      expect(recovered).not.toBe(second)
      await assertSelectedWechatDevtoolsRuntime(target!, recovered)
      await navigate('second-reconnected', recovered, fixtures[1].routes[1])
    }
    await assertLoggedIn()
  }, TIMEOUT)
})
