import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'
import { NATIVE_TEMPLATE_DOM } from '../utils/templateAcceptance/native'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-template')
const JS_FORMATS = ['esm', 'cjs'] as const

describe('template e2e: weapp-vite-template', { concurrent: false }, () => {
  // 两种模块格式各自重建并冷启动，避免上一次模块缓存掩盖格式兼容问题。
  for (const jsFormat of JS_FORMATS) {
    it(`renders all pages from app config in ${jsFormat}`, async (context) => {
      await runTemplateE2E({
        context,
        acceptance: NATIVE_TEMPLATE_DOM,
        jsFormat,
        templateRoot: TEMPLATE_ROOT,
        templateName: 'weapp-vite-template',
      })
    })
  }
})
