import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-tailwindcss-template')

describe('template e2e: weapp-vite-tailwindcss-template', { concurrent: false }, () => {
  it('renders all pages from app config', async () => {
    await runTemplateE2E({
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-tailwindcss-template',
    })
  })
})
