import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'
import { multiPlatformTemplateDom } from '../utils/templateAcceptance/native'

const TEMPLATE_ROOT = path.resolve(
  import.meta.dirname,
  '../../templates/weapp-vite-multi-platform-sfc-template',
)

describe('template e2e: weapp-vite-multi-platform-sfc-template', { concurrent: false }, () => {
  it('renders and updates the WeChat SFC target', async (context) => {
    await runTemplateE2E({
      context,
      acceptance: multiPlatformTemplateDom(true),
      buildPlatform: 'weapp',
      distRoot: 'dist/weapp/dist',
      ideProjectRoot: 'dist/weapp',
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-multi-platform-sfc-template',
    })
  })
})
