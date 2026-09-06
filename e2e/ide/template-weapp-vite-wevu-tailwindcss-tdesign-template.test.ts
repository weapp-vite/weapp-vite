import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'
import { WEVU_TDESIGN_TEMPLATE_DOM } from '../utils/templateAcceptance/wevu'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')

describe('template e2e: weapp-vite-wevu-tailwindcss-tdesign-template', { concurrent: false }, () => {
  it('renders all pages from app config', async (context) => {
    await runTemplateE2E({
      context,
      acceptance: WEVU_TDESIGN_TEMPLATE_DOM,
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-wevu-tailwindcss-tdesign-template',
      warmupRoute: '/pages/index/index',
    })
  })
})
