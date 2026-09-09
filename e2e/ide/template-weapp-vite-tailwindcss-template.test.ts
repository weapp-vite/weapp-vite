import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'
import { tailwindTemplateDom } from '../utils/templateAcceptance/native'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-tailwindcss-template')

describe('template e2e: weapp-vite-tailwindcss-template', { concurrent: false }, () => {
  it('renders all pages from app config', async (context) => {
    await runTemplateE2E({
      context,
      acceptance: tailwindTemplateDom('tailwind'),
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-tailwindcss-template',
    })
  })
})
