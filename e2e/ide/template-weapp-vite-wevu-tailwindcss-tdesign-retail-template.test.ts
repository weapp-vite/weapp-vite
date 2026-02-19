import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template', () => {
  it('renders all pages from app config', async () => {
    await runTemplateE2E({
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-wevu-tailwindcss-tdesign-retail-template',
    })
  })
})
