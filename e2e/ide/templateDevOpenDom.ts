import type { DomCheckpoint } from '../utils/domAcceptance/types'
import type { TemplateDevOpenCase } from './template-dev-open-cases'
import { multiPlatformTemplateDom, NATIVE_TEMPLATE_DOM, tailwindTemplateDom } from '../utils/templateAcceptance/native'
import { RETAIL_TEMPLATE_DOM } from '../utils/templateAcceptance/retail'
import { WEVU_TDESIGN_TEMPLATE_DOM, WEVU_TEMPLATE_DOM } from '../utils/templateAcceptance/wevu'

export function templateDevOpenCheckpoint(template: TemplateDevOpenCase): DomCheckpoint {
  const plans = {
    'weapp-vite-template': NATIVE_TEMPLATE_DOM,
    'weapp-vite-multi-platform-template': multiPlatformTemplateDom(false),
    'weapp-vite-multi-platform-sfc-template': multiPlatformTemplateDom(true),
    'weapp-vite-tailwindcss-template': tailwindTemplateDom('tailwind'),
    'weapp-vite-tailwindcss-tdesign-template': tailwindTemplateDom('tdesign'),
    'weapp-vite-tailwindcss-vant-template': tailwindTemplateDom('vant'),
    'weapp-vite-wevu-template': WEVU_TEMPLATE_DOM,
    'weapp-vite-wevu-tailwindcss-tdesign-template': WEVU_TDESIGN_TEMPLATE_DOM,
    'weapp-vite-wevu-tailwindcss-tdesign-retail-template': RETAIL_TEMPLATE_DOM,
  }
  const plan = plans[template.name as keyof typeof plans]?.find(item => item.route === template.route)?.steps[0]
  if (plan) {
    return { ...plan, id: 'opened', action: 'dev:open 后检查当前模板的实际页面和组件内容' }
  }
  if (template.name === 'weapp-vite-plugin-template') {
    return {
      id: 'opened',
      route: template.route,
      action: 'dev:open 后检查插件宿主呈现的 API 结果和插件入口',
      nodes: [
        { selector: '.hero__title', text: '插件能力混合演示' },
        { selector: '#plugin-answer', text: 'plugin.answer = 42' },
        { selector: 'navigator', count: 2 },
      ],
    }
  }
  if (template.name === 'weapp-vite-lib-template') {
    return {
      id: 'opened',
      route: template.route,
      action: 'dev:open 后检查组件库调试页面的实际标题和示例分组',
      nodes: [
        { selector: '.title', text: 'weapp-vite component library' },
        { selector: '.section-title', count: 3 },
        { selector: '.layout-btn', text: '打开布局演示页' },
      ],
    }
  }
  throw new Error(`Missing dev:open DOM checkpoint for ${template.name} ${template.route}`)
}
