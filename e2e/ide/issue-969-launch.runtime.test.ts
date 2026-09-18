import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'

const ROOT = path.resolve(import.meta.dirname, '../..')
describe('issue #969: native cold launch navigation', () => {
  let project: string
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>>
  beforeAll(async () => {
    const parent = path.join(ROOT, '.tmp/e2e-projects')
    await mkdir(parent, { recursive: true })
    project = await mkdtemp(path.join(parent, 'issue-969-'))
    await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-969'), project, { recursive: true })
    miniProgram = await launchAutomator({
      projectPath: project,
      warmupRoute: '/pages/login/index',
      warmupAllowRelaunch: false,
      warmupRootSelectors: ['view'],
    })
  }, 180_000)
  afterAll(async () => {
    await miniProgram?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)
  it('loads the host entry before redirecting and keeps later navigation usable', async (context) => {
    const dom = createDomAcceptance(context, 'e2e-apps/github-issues/fixtures/issue-969', [
      { id: 'cold', route: '/pages/login/index', action: '冷启动重定向最终进入登录页', nodes: [{ selector: '#issue-969-login', text: 'login' }] },
      { id: 'later', route: '/pages/home/index', action: '后续普通导航能回到首页', nodes: [{ selector: '#issue-969-home', text: 'home' }] },
    ])
    await expect.poll(() => miniProgram.evaluate(() => getApp().globalData.events)).toContain('redirect:complete')
    const data = await miniProgram.evaluate(() => getApp().globalData)
    process.stdout.write(`[issue-969 lifecycle] ${JSON.stringify(data)}\n`)
    expect(data).toMatchObject({ loads: ['home', 'login'], launchCalls: 1, events: [
      'app:launch:start',
      'app:launch:end',
      'app:show',
      'home:load',
      'home:show',
      'home:unload',
      'login:load',
      'login:show',
      'login:ready',
      'redirect:success',
      'redirect:complete',
    ] })
    await dom.check('cold', miniProgram, await miniProgram.currentPage())
    const page = await miniProgram.reLaunch('/pages/home/index')
    await dom.check('later', miniProgram, page)
    expect(await miniProgram.evaluate(() => getApp().globalData)).toMatchObject({ loads: ['home', 'login', 'home'], launchCalls: 1 })
  })
})
