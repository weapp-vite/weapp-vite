import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssue1058Project, createIssue1058Project, ISSUE_1058_FIXTURE } from '../utils/issue1058Project'

const home = '/pages/home/index'
const boundary = '/pages/boundary/index'

describe('issue #1058 shared template tag analysis runtime', { concurrent: false }, () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined

  beforeAll(async () => {
    project = await createIssue1058Project()
    await buildIssue1058Project(project)
    const readJson = async (file: string) => JSON.parse(await readFile(path.join(project!, file), 'utf8')) as Record<string, unknown>
    expect((await readJson('project.config.json')).appid).toMatch(/^wx[\da-f]+$/)
    const conditions = await readJson('project.private.config.json')
    expect(conditions).toHaveProperty('condition.miniprogram.list', expect.arrayContaining([
      expect.objectContaining({ pathName: home.slice(1) }),
      expect.objectContaining({ pathName: boundary.slice(1) }),
    ]))
    const homeConfig = await readJson(`dist${home}.json`)
    const boundaryConfig = await readJson(`dist${boundary}.json`)
    expect(homeConfig.usingComponents).toEqual({ 'case-card': '/components/CaseCard/index' })
    expect(boundaryConfig.usingComponents).toEqual({ month: '/components/CaseCard/index' })
    const app = await readJson('dist/app.json')
    expect(app.pages).toEqual([home.slice(1), boundary.slice(1)])
    for (const output of [home, boundary, '/components/CaseCard/index']) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist${output}.${extension}`))
      }
    }
    host = await launchAutomator({ projectPath: project, bridgeProjectMode: 'direct', warmupRoute: home, warmupRootSelectors: ['#tag-page'] })
  }, 180_000)

  afterAll(async () => {
    try {
      await host?.close()
    }
    finally {
      if (project) {
        await rm(project, { recursive: true, force: true })
      }
    }
  }, 30_000)

  it('renders both tag spellings and duplicates with reactive updates', async (context) => {
    const dom = createDomAcceptance(context, ISSUE_1058_FIXTURE, [0, 1].map(count => ({
      id: `count-${count}`,
      route: home,
      action: '检查两种命名及重复组件的响应式更新',
      nodes: [
        { selector: '#builtin', text: 'builtin' },
        { selector: '#pascal', text: `pascal-${count}` },
        { selector: '#kebab', text: `kebab-${count}` },
        { selector: '#duplicate', text: `duplicate-${count}` },
        { selector: '#increment', text: String(count) },
      ],
    })))
    const page = await host!.reLaunch(home)
    await dom.check('count-0', host!, page)
    await (await page.$('#increment'))!.tap()
    await dom.check('count-1', host!, page)
  })

  it('preserves lowercase explicit imports through branch removal and restoration', async (context) => {
    const dom = createDomAcceptance(context, ISSUE_1058_FIXTURE, [true, false, true].map((visible, index) => ({
      id: `branch-${index}`,
      route: boundary,
      action: '检查显式导入、保留模板标签和条件分支',
      nodes: [
        { selector: '#lowercase', ...(visible ? { text: 'explicit-lowercase' } : { count: 0 }) },
        { selector: '#explicit-pascal', ...(visible ? { text: 'explicit-pascal' } : { count: 0 }) },
        { selector: '#toggle', text: visible ? 'visible' : 'hidden' },
      ],
    })))
    const page = await host!.reLaunch(boundary)
    await dom.check('branch-0', host!, page)
    await (await page.$('#toggle'))!.tap()
    await dom.check('branch-1', host!, page)
    await (await page.$('#toggle'))!.tap()
    await dom.check('branch-2', host!, page)
  })
})
