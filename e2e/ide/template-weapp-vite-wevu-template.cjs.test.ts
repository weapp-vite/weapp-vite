import path from 'pathe'
import { describe, it } from 'vitest'
import { runTemplateE2E } from '../template-e2e.utils'
import { WEVU_TEMPLATE_DOM } from '../utils/templateAcceptance/wevu'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-template')

// 每种模块格式作为独立 task 运行，由 suite runner 在两次 IDE 启动间回收宿主。
describe('template e2e: weapp-vite-wevu-template', { concurrent: false }, () => {
  it('renders all pages from app config in cjs', async (context) => {
    await runTemplateE2E({
      context,
      acceptance: WEVU_TEMPLATE_DOM,
      jsFormat: 'cjs',
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-wevu-template',
    })
  })
})
