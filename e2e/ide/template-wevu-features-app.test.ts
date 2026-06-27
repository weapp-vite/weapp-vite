import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-features')

describe.sequential('template e2e: wevu-features-app', () => {
  it('renders all pages from app config', async (ctx) => {
    await runTemplateE2E({
      skip: ctx.skip,
      templateRoot: APP_ROOT,
      templateName: 'wevu-features-app',
    })
  })
})
