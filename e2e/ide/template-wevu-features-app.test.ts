import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-features')

describe('template e2e: wevu-features-app', { concurrent: false }, () => {
  it('renders all pages from app config', async () => {
    await runTemplateE2E({
      templateRoot: APP_ROOT,
      templateName: 'wevu-features-app',
    })
  })
})
