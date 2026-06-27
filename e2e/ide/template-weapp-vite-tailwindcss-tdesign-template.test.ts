import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-tailwindcss-tdesign-template')
const TEMPLATE_PROTOCOL_LIMITATION_MESSAGE = 'WeChat DevTools 页面协议在 weapp-vite-tailwindcss-tdesign-template 上不稳定，跳过该模板的 IDE 全量页面快照。'

describe.sequential('template e2e: weapp-vite-tailwindcss-tdesign-template', () => {
  it('renders all pages from app config', async (ctx) => {
    ctx.skip(TEMPLATE_PROTOCOL_LIMITATION_MESSAGE)
    await runTemplateE2E({
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-tailwindcss-tdesign-template',
    })
  })
})
