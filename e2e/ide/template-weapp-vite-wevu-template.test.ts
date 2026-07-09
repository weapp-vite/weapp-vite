import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-template')
const JS_FORMATS = ['esm', 'cjs'] as const

describe.sequential('template e2e: weapp-vite-wevu-template', () => {
  for (const jsFormat of JS_FORMATS) {
    it(`renders all pages from app config in ${jsFormat}`, async () => {
      await runTemplateE2E({
        jsFormat,
        templateRoot: TEMPLATE_ROOT,
        templateName: 'weapp-vite-wevu-template',
      })
    })
  }
})
