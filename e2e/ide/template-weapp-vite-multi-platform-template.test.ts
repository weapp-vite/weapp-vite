import path from 'pathe'
import { runTemplateE2E } from '../template-e2e.utils'
import { multiPlatformTemplateDom } from '../utils/templateAcceptance/native'

const TEMPLATE_ROOT = path.resolve(
  import.meta.dirname,
  '../../templates/weapp-vite-multi-platform-template',
)

describe('template e2e: weapp-vite-multi-platform-template', { concurrent: false }, () => {
  it('renders and updates the WeChat target', async (context) => {
    await runTemplateE2E({
      context,
      acceptance: multiPlatformTemplateDom(false),
      buildPlatform: 'weapp',
      distRoot: 'dist/weapp/dist',
      ideProjectRoot: 'dist/weapp',
      templateRoot: TEMPLATE_ROOT,
      templateName: 'weapp-vite-multi-platform-template',
    })
  })
})
