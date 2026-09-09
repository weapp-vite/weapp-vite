import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { TDESIGN_FIXTURE } from './tdesignDom'
import { classBindingCheckpoints, readBindingState } from './tdesignDom/classBinding'
import {
  createTemplateWevuTdesignRegressionLaunchOptions,
  relaunchTemplateWevuTdesignRegressionPage,
} from './template-wevu-tdesign-regression.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/subpackages/lab/class-binding/index'
let sharedMiniProgram: any = null

describe('e2e app: template-wevu-tdesign-regression class/style binding lab', { concurrent: false }, () => {
  beforeAll(async () => {
    await fs.remove(DIST_ROOT)
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: TEMPLATE_ROOT,
      platform: 'weapp',
      cwd: TEMPLATE_ROOT,
      label: 'ide:template-wevu-tdesign-regression-class-style-bindings',
    })
    sharedMiniProgram = await launchAutomator(createTemplateWevuTdesignRegressionLaunchOptions(TEMPLATE_ROOT))
  }, 240_000)

  afterAll(async () => {
    if (sharedMiniProgram) {
      await sharedMiniProgram.close()
      sharedMiniProgram = null
    }
  })

  it('covers class/style binding branches with interactive scenarios', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, classBindingCheckpoints)
    const miniProgram = sharedMiniProgram
    const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, ROUTE, 'class/style binding')
    await page.waitFor(500)
    await acceptance.check('initial', miniProgram, page)

    await page.callMethod('applyScenarioBase')
    await page.waitFor(500)
    await acceptance.check('base', miniProgram, page)
    expect(await readBindingState(page)).toMatchObject({ isActive: false, hasError: false, isRound: false, isGhost: false })

    await page.callMethod('applyScenarioAllOn')
    await page.waitFor(500)
    await acceptance.check('all-on', miniProgram, page)
    expect(await readBindingState(page)).toMatchObject({
      isActive: true,
      hasError: true,
      isRound: true,
      isGhost: true,
      classObject: { 'demo-active': true, 'text-danger': true, 'demo-round': true, 'demo-ghost': true },
    })

    await page.callMethod('applyScenarioMixed')
    await page.waitFor(500)
    await acceptance.check('mixed', miniProgram, page)
    expect(await readBindingState(page)).toMatchObject({ isActive: true, hasError: false, isRound: true, isGhost: false })

    await page.callMethod('applyScenarioErrorGhost')
    await page.waitFor(500)
    await acceptance.check('error-ghost', miniProgram, page)
    expect(await readBindingState(page)).toMatchObject({
      isActive: false,
      hasError: true,
      isRound: false,
      isGhost: true,
      errorClassIf: 'text-danger',
      ghostClassIf: 'demo-ghost',
    })
  })
})
