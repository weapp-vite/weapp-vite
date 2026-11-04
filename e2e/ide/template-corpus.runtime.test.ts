import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildTemplateCorpusProject, createTemplateCorpusProject, TEMPLATE_CORPUS_FIXTURE, TEMPLATE_CORPUS_ROUTES } from '../utils/templateCorpusProject'

const [adjacent, bindings] = TEMPLATE_CORPUS_ROUTES

describe('template corpus native adjacent attribute semantics', { concurrent: false }, () => {
  let project: string | undefined
  let host: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let launchStarted = false

  beforeAll(async () => {
    project = await createTemplateCorpusProject()
    await buildTemplateCorpusProject(project)
    const readJson = async (file: string) => JSON.parse(await readFile(path.join(project!, file), 'utf8')) as Record<string, unknown>
    expect((await readJson('project.config.json')).appid).toMatch(/^wx[\da-f]+$/)
    expect(await readJson('project.private.config.json')).toHaveProperty('condition.miniprogram.list', expect.arrayContaining(
      TEMPLATE_CORPUS_ROUTES.map(route => expect.objectContaining({ pathName: route.slice(1) })),
    ))
    expect((await readJson('dist/app.json')).pages).toEqual(TEMPLATE_CORPUS_ROUTES.map(route => route.slice(1)))
    for (const route of TEMPLATE_CORPUS_ROUTES) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist${route}.${extension}`))
      }
    }
    launchStarted = true
    host = await launchAutomator({ projectPath: project, bridgeProjectMode: 'direct', warmupRoute: adjacent, warmupRootSelectors: ['#corpus-adjacent'] })
    const info = await host.send('Tool.getInfo', {}, { timeout: 5_000 })
    process.stdout.write(`[template-corpus runtime] devtools=${info.version ?? '<headless>'} baseLibrary=${info.SDKVersion ?? '<unknown>'}\n`)
  }, 180_000)

  afterAll(async () => {
    // 启动未返回会话时保留 fixture，交由受管 journal 确认资源终结后再回收。
    if (launchStarted && !host) {
      return
    }
    await host?.close()
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  }, 30_000)

  it('preserves adjacent quoted values and explicit empty values across a bare attribute', async (context) => {
    const dom = createDomAcceptance(context, TEMPLATE_CORPUS_FIXTURE, ['pending', 'one|two|string|'].map((result, index) => ({
      id: `adjacent-${index}`,
      route: adjacent,
      action: '核验连续引号属性、裸属性后的显式空值及事件 dataset',
      nodes: [
        { selector: '#adjacent-probe', text: 'adjacent', attributes: { 'data-first': 'one', 'data-second': 'two', 'data-empty': '' } },
        { selector: '#adjacent-result', text: result },
      ],
    })))
    const page = await host!.reLaunch(adjacent)
    await dom.check('adjacent-0', host!, page)
    await (await page.$('#adjacent-probe'))!.tap()
    await dom.check('adjacent-1', host!, page)
  })

  it('retains adjacent directive and event boundaries across reactive branch updates', async (context) => {
    const states = [
      { count: 0, label: 'initial', visible: true },
      { count: 1, label: 'updated', visible: true, target: '#binding-probe' },
      { count: 1, label: 'updated', visible: false, target: '#toggle' },
      { count: 2, label: 'updated', visible: false, target: '#update' },
      { count: 2, label: 'updated', visible: true, target: '#toggle' },
    ]
    const dom = createDomAcceptance(context, TEMPLATE_CORPUS_FIXTURE, states.map((state, index) => ({
      id: `binding-${index}`,
      route: bindings,
      action: '核验相邻指令、属性、事件及隐藏期间的数据更新',
      nodes: [
        { selector: '#binding-probe', ...(state.visible
          ? { text: `${state.label}:${state.count}`, attributes: { 'class': `visible-${state.count}`, 'data-value': String(state.count + 1), 'data-label': state.label } }
          : { count: 0 }) },
        { selector: '#binding-state', text: `${state.visible ? 'visible' : 'hidden'}:${state.count}` },
      ],
    })))
    const page = await host!.reLaunch(bindings)
    for (const [index, state] of states.entries()) {
      if (state.target) {
        await (await page.$(state.target))!.tap()
      }
      await dom.check(`binding-${index}`, host!, page)
    }
  })
})
