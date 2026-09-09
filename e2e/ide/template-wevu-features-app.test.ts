import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'
import { WEVU_FEATURES_TEMPLATE_DOM } from '../utils/templateAcceptance/features'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-features')

describe('template e2e: wevu-features-app', { concurrent: false }, () => {
  it('renders all pages from app config', async (context) => {
    await runTemplateE2E({
      context,
      acceptance: WEVU_FEATURES_TEMPLATE_DOM,
      templateRoot: APP_ROOT,
      templateName: 'wevu-features-app',
    })
  })
})
