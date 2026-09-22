import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssue1029Project, ISSUE_1029_HOME, ISSUE_1029_LEGACY, ISSUE_1029_PROFILE, runIssue1029Command } from '../utils/issue1029Project'

interface RouteSnapshot {
  route: { name: string | null, path: string, meta: Record<string, unknown> | null, query: Record<string, unknown> }
  records: Array<{ name: string, path: string, meta: Record<string, unknown> }>
  trace: Array<{ phase: string, to?: string, from?: string, title?: unknown }>
  failureType?: number | null
}

const MOVED_PROFILE = '/subpackages/account/pages/moved/index'
let project: string
let miniProgram: MiniProgram | undefined

describe('issue #1029: static named routes and runtime metadata', { concurrent: false }, () => {
  beforeAll(async () => {
    project = await createIssue1029Project()
    await runIssue1029Command(project, 'prepare')
    const beforeMove = await readFile(path.join(project, '.weapp-vite/typed-router.d.ts'), 'utf8')
    expect(beforeMove).toContain(ISSUE_1029_PROFILE.slice(1))
    await rename(path.join(project, 'src/subpackages/account/pages/profile'), path.join(project, 'src/subpackages/account/pages/moved'))
    const privateConfigPath = path.join(project, 'project.private.config.json')
    const privateConfig = await readFile(privateConfigPath, 'utf8')
    await writeFile(privateConfigPath, privateConfig.replace(ISSUE_1029_PROFILE.slice(1), MOVED_PROFILE.slice(1)))
    await runIssue1029Command(project, 'build')
    const afterMove = await readFile(path.join(project, '.weapp-vite/typed-router.d.ts'), 'utf8')
    expect(afterMove).toContain(MOVED_PROFILE.slice(1))
    expect(afterMove).not.toContain(ISSUE_1029_PROFILE.slice(1))
    const config = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as {
      pages: string[]
      subPackages: Array<{ root: string, pages: string[] }>
    }
    const registered = [...config.pages, ...config.subPackages.flatMap(pkg => pkg.pages.map(page => `${pkg.root}/${page}`))]
    expect(registered.sort()).toEqual([ISSUE_1029_HOME, ISSUE_1029_LEGACY, MOVED_PROFILE].map(route => route.slice(1)).sort())
    for (const route of registered) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist/${route}.${extension}`))
      }
    }
    const emittedPages = await Promise.all(registered.map(route => readFile(path.join(project, `dist/${route}.js`), 'utf8')))
    expect(emittedPages.join('\n')).not.toMatch(/\b(?:definePage|declarePage)\s*\(/)
    const hostConfig = JSON.parse(await readFile(path.join(project, 'dist/pages/home/index.json'), 'utf8')) as Record<string, unknown>
    expect(hostConfig.navigationBarTitleText).toBe('宿主标题')
    miniProgram = await launchAutomator({
      projectPath: project,
      warmupRoute: ISSUE_1029_HOME,
      warmupRootSelectors: ['#issue-1029-home'],
    })
  }, 180_000)

  afterAll(async () => {
    await miniProgram?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)

  it('finishes the initial guard before mounting and does not name unannotated pages', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1029', [{
      id: 'initial',
      route: ISSUE_1029_HOME,
      action: '检查首屏异步守卫与声明元信息',
      nodes: [{ selector: '#route-title', text: '首页' }],
    }])
    const host = miniProgram!
    const page = await host.currentPage()
    expect(page.path).toBe(ISSUE_1029_HOME.slice(1))
    await dom.check('initial', host, page)
    await expect.poll(async () => (await page.callMethod('_runE2E') as RouteSnapshot).trace)
      .toContainEqual({ phase: 'mounted', to: 'home' })
    const state = await page.callMethod('_runE2E') as RouteSnapshot
    expect(state.records.map(route => route.name).sort()).toEqual(['home', 'profile'])
    expect(state.route).toMatchObject({ name: 'home', meta: { title: '首页', requiresAuth: false, tags: ['public'] } })
    const firstGuard = state.trace.find(event => event.phase === 'before')
    expect(firstGuard?.to).toBe('home')
    expect(firstGuard?.from).toBeUndefined()
    expect(firstGuard?.title).toBe('首页')
    const resolved = state.trace.findIndex(event => event.phase === 'resolve' && event.to === 'home')
    const mounted = state.trace.findIndex(event => event.phase === 'mounted' && event.to === 'home')
    expect(resolved).toBeGreaterThanOrEqual(0)
    expect(mounted).toBeGreaterThan(resolved)
  })

  it('navigates by an unchanged name after the page moves and preserves meta through back navigation', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1029', [
      { id: 'profile', route: MOVED_PROFILE, action: '通过稳定名称跳转到移动后的分包页面', nodes: [{ selector: '#route-title', text: '个人资料' }] },
      { id: 'back', route: ISSUE_1029_HOME, action: '返回主页并恢复关联元信息', nodes: [{ selector: '#route-title', text: '首页' }] },
    ])
    const host = miniProgram!
    const home = await host.reLaunch(ISSUE_1029_HOME)
    await expect.poll(async () => (await home.callMethod('_runE2E') as RouteSnapshot).route.name).toBe('home')
    // DevTools 的 Page.callMethod 不等待 Promise；使用已有 AppService 完成态协议。
    await home.callMethodWithOptions('_runE2E', { routeOnly: true }, 'profile')
    await expect.poll(async () => (await host.currentPage()).path).toBe(MOVED_PROFILE.slice(1))
    const profile = await host.currentPage()
    await dom.check('profile', host, profile)
    const state = await profile.callMethod('_runE2E') as RouteSnapshot
    expect(state.route).toMatchObject({ name: 'profile', path: MOVED_PROFILE.slice(1), meta: { title: '个人资料', requiresAuth: true, role: 'member', limits: { count: 3 }, nullable: null }, query: { source: 'home' } })
    expect(state.trace).toContainEqual({ phase: 'resolve', to: 'profile', from: 'home' })
    expect(state.trace).toContainEqual({ phase: 'before', to: 'profile', from: 'home', title: '个人资料' })
    await profile.callMethodWithOptions('_runE2E', { routeOnly: true }, 'back')
    await expect.poll(async () => (await host.currentPage()).path).toBe(ISSUE_1029_HOME.slice(1))
    const returned = await host.currentPage()
    await dom.check('back', host, returned)
    expect((await returned.callMethod('_runE2E') as RouteSnapshot).route.name).toBe('home')
  })

  it('retains the current route on abort and applies named guard redirects', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1029', [
      { id: 'abort', route: ISSUE_1029_HOME, action: '中止命名导航不改变当前页面', nodes: [{ selector: '#route-title', text: '首页' }] },
      { id: 'redirect', route: ISSUE_1029_HOME, action: '守卫重定向使用同一名称映射', nodes: [{ selector: '#route-title', text: '首页' }] },
    ])
    const host = miniProgram!
    const home = await host.reLaunch(ISSUE_1029_HOME)
    await expect.poll(async () => (await home.callMethod('_runE2E') as RouteSnapshot).route.name).toBe('home')
    const aborted = await home.callMethodWithOptions('_runE2E', { routeOnly: true }, 'abort') as RouteSnapshot
    expect(aborted.failureType).toBe(4)
    expect(aborted.route.name).toBe('home')
    await dom.check('abort', host, home)
    await home.callMethodWithOptions('_runE2E', { routeOnly: true }, 'redirect')
    await expect.poll(async () => (await (await host.currentPage()).callMethod('_runE2E') as RouteSnapshot).route.query.redirected).toBe('yes')
    const redirected = await host.currentPage()
    await dom.check('redirect', host, redirected)
    expect((await redirected.callMethod('_runE2E') as RouteSnapshot).route).toMatchObject({ name: 'home', meta: { title: '首页' } })
  })

  it('keeps path navigation to a page without route metadata unnamed', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-1029', [{
      id: 'legacy',
      route: ISSUE_1029_LEGACY,
      action: '未声明页面仍可按路径访问且没有伪造名称',
      nodes: [{ selector: '#legacy-title', text: 'Unannotated page' }],
    }])
    const host = miniProgram!
    const home = await host.reLaunch(ISSUE_1029_HOME)
    await expect.poll(async () => (await home.callMethod('_runE2E') as RouteSnapshot).route.name).toBe('home')
    await home.callMethodWithOptions('_runE2E', { routeOnly: true }, 'legacy')
    await expect.poll(async () => (await host.currentPage()).path).toBe(ISSUE_1029_LEGACY.slice(1))
    const legacy = await host.currentPage()
    await dom.check('legacy', host, legacy)
    const state = await legacy.callMethod('_runE2E') as RouteSnapshot
    expect(state.route.name).toBeNull()
    expect(state.route.path).toBe(ISSUE_1029_LEGACY.slice(1))
  })
})
