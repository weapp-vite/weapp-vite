import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { renderedText, tapRendered, TDESIGN_FIXTURE } from './tdesignDom'
import { closeTdesignRegressionSession, getTdesignRegressionSession } from './tdesignRegressionSession'
import { relaunchTemplateWevuTdesignRegressionPage } from './template-wevu-tdesign-regression.shared'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const FORM_WXML_PATH = path.join(DIST_ROOT, 'pages/form/index.wxml')
const ROUTE = '/pages/form/index'

function normalizeBoolean(value: unknown) {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return Boolean(value)
}

let sharedMiniProgram: any = null

async function getSharedMiniProgram() {
  sharedMiniProgram ??= await getTdesignRegressionSession()
  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  sharedMiniProgram = null
  await closeTdesignRegressionSession()
}

async function getFormState(page: any) {
  const data = await page.data()
  return {
    currentStep: Number(data.currentStep),
    urgent: normalizeBoolean(data.formState?.urgent),
    pace: String(data.formState?.pace),
  }
}

describe('e2e app: template-wevu-tdesign-regression form', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('renders urgent controls and exposes initial urgent runtime state', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, [
      { id: 'initial', route: ROUTE, action: '打开表单并检查加急默认状态', nodes: [renderedText('form-urgent-state', '加急未开启 · 平衡'), { selector: '//*[@aria-role="switch"]', query: 'xpath', attributes: { 'aria-checked': 'false' } }] },
      { id: 'urgent-on', route: ROUTE, action: '点击加急行，验证开关及节奏联动', nodes: [renderedText('form-urgent-state', '加急已开启 · 快速推进'), { selector: '//*[@aria-role="switch"]', query: 'xpath', attributes: { 'aria-checked': 'true' } }] },
      { id: 'urgent-off', route: ROUTE, action: '再次点击加急行，验证关闭后保留推进节奏', nodes: [renderedText('form-urgent-state', '加急未开启 · 快速推进'), { selector: '//*[@aria-role="switch"]', query: 'xpath', attributes: { 'aria-checked': 'false' } }] },
      { id: 'switch-on', route: ROUTE, action: '点击实际 switch 控件，验证事件不会冒泡反转状态', nodes: [renderedText('form-urgent-state', '加急已开启 · 快速推进'), { selector: '//*[@aria-role="switch"]', query: 'xpath', attributes: { 'aria-checked': 'true' } }] },
    ])
    const miniProgram = await getSharedMiniProgram()
    const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, ROUTE, 'form')
    expect(page).toBeTruthy()

    const formWxml = await fs.readFile(FORM_WXML_PATH, 'utf8')
    expect(formWxml).toContain('urgent-row-toggle')
    expect(formWxml).toContain('e2e-urgent-switch-toggle')

    expect(await getFormState(page)).toMatchObject({
      currentStep: 0,
      urgent: false,
      pace: 'balanced',
    })

    expect(page.path).toBe(ROUTE.slice(1))
    await acceptance.check('initial', miniProgram, page)
    await tapRendered(page, '//*[@id="form-urgent-row"]')
    await acceptance.check('urgent-on', miniProgram, page)
    expect(await getFormState(page)).toMatchObject({ urgent: true, pace: 'fast' })
    await tapRendered(page, '//*[@id="form-urgent-row"]')
    await acceptance.check('urgent-off', miniProgram, page)
    await tapRendered(page, '//*[@aria-role="switch"]')
    await acceptance.check('switch-on', miniProgram, page)
    expect(await getFormState(page)).toMatchObject({ urgent: true, pace: 'fast' })
  })
})
