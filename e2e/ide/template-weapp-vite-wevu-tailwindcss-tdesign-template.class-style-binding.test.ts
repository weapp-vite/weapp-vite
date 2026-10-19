import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { TDESIGN_FIXTURE } from './tdesignDom'
import { classBindingCheckpoints, readBindingState } from './tdesignDom/classBinding'
import { closeTdesignRegressionSession, getTdesignRegressionSession } from './tdesignRegressionSession'
import {
  relaunchTemplateWevuTdesignRegressionPage,
} from './template-wevu-tdesign-regression.shared'

const ROUTE = '/subpackages/lab/class-binding/index'
let sharedMiniProgram: any = null

describe('e2e app: template-wevu-tdesign-regression class/style binding lab', { concurrent: false }, () => {
  beforeAll(async () => {
    sharedMiniProgram = await getTdesignRegressionSession()
  }, 240_000)

  afterAll(async () => {
    if (sharedMiniProgram) {
      await closeTdesignRegressionSession()
      sharedMiniProgram = null
    }
  })

  it('covers class/style binding branches with interactive scenarios', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, classBindingCheckpoints)
    const miniProgram = sharedMiniProgram
    const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, ROUTE, 'class/style binding')
    await acceptance.check('initial', miniProgram, page)

    await page.callMethod('applyScenarioBase')
    await acceptance.check('base', miniProgram, page)
    expect(await readBindingState(page)).toMatchObject({ isActive: false, hasError: false, isRound: false, isGhost: false })

    await page.callMethod('applyScenarioAllOn')
    await acceptance.check('all-on', miniProgram, page)
    expect(await readBindingState(page)).toMatchObject({
      isActive: true,
      hasError: true,
      isRound: true,
      isGhost: true,
      classObject: { 'demo-active': true, 'text-danger': true, 'demo-round': true, 'demo-ghost': true },
    })

    await page.callMethod('applyScenarioMixed')
    await acceptance.check('mixed', miniProgram, page)
    expect(await readBindingState(page)).toMatchObject({ isActive: true, hasError: false, isRound: true, isGhost: false })

    await page.callMethod('applyScenarioErrorGhost')
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
