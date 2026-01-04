import { tdesignComponentTags, toTDesignComponentName } from './pages/ui-tdesign/components-list'
import { toVantComponentName, vantComponentTags } from './pages/ui-vant/components-list'

export const tabBarPages = [
  'pages/index/index',
  'pages/ui-tdesign/index',
  'pages/ui-vant/index',
] as const

export const tdesignComponentPages = tdesignComponentTags.map(tag => `pages/ui-tdesign/components/${toTDesignComponentName(tag)}/index`)
export const vantComponentPages = vantComponentTags.map(tag => `pages/ui-vant/components/${toVantComponentName(tag)}/index`)

export const extraPages = [
  'pages/subpackage-scenarios/index',
  'pages/basic/index',
  'pages/computed/index',
  'pages/watch/index',
  'pages/lifecycle/index',
  'pages/wevu-hooks/index',
  'pages/auto-features/index',
  'pages/setup/index',
  'pages/created-setup/index',
  'pages/component/index',
  'pages/slot/index',
  'pages/component-interop/index',
  'pages/store/index',
  'pages/store-shared/index',
  'pages/vue-template/index',
  'pages/vue-bindings/index',
  'pages/vue-events/index',
  'pages/vue-v-model/index',
  'pages/vue-dynamic/index',
  'pages/vue-script-setup/index',
  'pages/json-macros/index',
  'pages/vue-auto-components/index',
  'pages/vue-render/index',
  'pages/vue-style/index',
  'pages/advanced/index',
] as const

export const appPages = [
  ...tabBarPages,
  ...extraPages,
  ...tdesignComponentPages,
  ...vantComponentPages,
]
