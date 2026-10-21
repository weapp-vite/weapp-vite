export const WEVU_TAILWIND_PROBE = 'wevu-tailwind-hmr-probe'
export const WEVU_TAILWIND_ROUTE = '/pages/index/index'
export const WEVU_TAILWIND_INITIAL_CLASS = 'bg-[#f6f7fb]'
export const WEVU_TAILWIND_INITIAL_HEX = 'f6f7fb'
export const WEVU_TAILWIND_UPDATES = [
  { action: 'modify', className: 'bg-[#dbeafe]', css: 'background-color: #dbeafe', escapedClass: 'bg-_b_hdbeafe_B', hex: 'dbeafe', color: 'rgb(219, 234, 254)' },
  { action: 'delete', className: '', css: '', escapedClass: '', hex: 'none', color: 'rgba(0, 0, 0, 0)' },
  { action: 'add', className: 'bg-[#fef3c7]', css: 'background-color: #fef3c7', escapedClass: 'bg-_b_hfef3c7_B', hex: 'fef3c7', color: 'rgb(254, 243, 199)' },
  { action: 'modify', className: 'bg-[#fce7f3]', css: 'background-color: #fce7f3', escapedClass: 'bg-_b_hfce7f3_B', hex: 'fce7f3', color: 'rgb(252, 231, 243)' },
] as const

/** 在启动前增加稳定观测节点及纯样式输入，不改变模板原有计数与 TDesign 交互。 */
export function addWevuTailwindProbe(source: string) {
  const target = `<view class="min-h-screen ${WEVU_TAILWIND_INITIAL_CLASS}`
  if (!source.includes(target)) {
    throw new Error('Expected the template index page to contain the initial Tailwind background class')
  }
  return `${source.replace(target, `<view id="${WEVU_TAILWIND_PROBE}" data-e2e-bg="${WEVU_TAILWIND_INITIAL_HEX}" class="e2e-stateful-style min-h-screen ${WEVU_TAILWIND_INITIAL_CLASS}`)}\n<style>\n.e2e-stateful-style { color: #1f1a3f; }\n</style>\n`
}

/** 背景更新有意修改编译模板的静态 class 和属性，必须走注册边界回退。 */
export function updateWevuTailwindProbe(source: string, previousClass: string, nextClass: string, previousHex: string, nextHex: string) {
  const probe = new RegExp(`(<view id="${WEVU_TAILWIND_PROBE}" data-e2e-bg=")${previousHex}(" class=")([^"]*)(")`)
  const match = source.match(probe)
  if (!match) {
    throw new Error(`Expected the runtime probe to use background marker ${previousHex}`)
  }
  const classes = match[3]!.split(/\s+/).filter(className => className && className !== previousClass)
  if (nextClass) {
    classes.push(nextClass)
  }
  return source.replace(probe, `$1${nextHex}$2${classes.join(' ')}$4`)
}

/** 同次保存新增局部样式节点和规则，保留全局 utility 与页面规则的优先级回归。 */
export function addWevuTailwindLocalPriority(source: string) {
  if (!source.includes('<t-tag ')) {
    throw new Error('Expected the template to contain the TDesign tag')
  }
  return source
    .replace('<t-tag ', '<view id="wevu-tailwind-local-probe" class="bg-[#fce7f3] local-priority">Local style</view>\n      <t-tag ')
    .replace('</style>', '.local-priority { background-color: #1f2937; }\n</style>')
}
