import type { DomCheckpoint, DomNodeExpectation, DomProvider } from '../../utils/domAcceptance/types'

export const REACT_FIXTURE = 'e2e-apps/react-runtime-spike'
export const GENERIC_ROUTE = '/pages/index/index'
export const STATIC_ROUTE = '/pages/static/index'
export const INTEROP_ROUTE = '/pages/interop/index'

export function counterCheckpoint(options: {
  id: string
  action: string
  mode: 'generic' | 'static'
  count: number
  name?: string
  appended?: boolean
}): DomCheckpoint {
  const { id, action, mode, count, name = 'React', appended = false } = options
  const nodes: DomNodeExpectation[] = [
    { selector: '#title', text: mode === 'generic' ? 'weapp-vite React runtime spike' : 'weapp-vite React static bindings' },
    { selector: '#count', text: `count:${count} doubled:${count * 2}` },
    { selector: '#greeting', text: `hello ${name}` },
    { selector: '#name-input', attributes: { placeholder: 'name' } },
    { selector: '.theme-light', count: 1 },
  ]
  if (mode === 'generic') {
    nodes.push(
      { selector: '.item', count: appended ? 3 : 2 },
      { selector: '#item-alpha', text: 'alpha' },
      { selector: '#item-beta', text: 'beta' },
      appended ? { selector: '#item-item-2', text: 'item-2' } : { selector: '#item-item-2', count: 0 },
    )
  }
  return { id, action, route: mode === 'generic' ? GENERIC_ROUTE : STATIC_ROUTE, nodes }
}

export const INTEROP_EDGES = [
  { id: 'react-to-native', scope: ['#react-parent-native'], owner: [], action: '#native-leaf-action', value: 1, result: '#react-native-result', updated: 'native:2' },
  { id: 'react-to-wevu', scope: ['#react-parent-wevu'], owner: [], action: '#wevu-leaf-action', value: 2, result: '#react-wevu-result', updated: 'wevu:3' },
  { id: 'native-to-wevu', scope: ['#native-parent-component', '#native-parent-wevu'], owner: ['#native-parent-component'], action: '#wevu-leaf-action', value: 3, result: '#native-wevu-result', updated: 'wevu:4' },
  { id: 'native-to-react', scope: ['#native-parent-component', '#native-parent-react'], owner: ['#native-parent-component'], action: '#react-leaf-action', value: 4, result: '#native-react-result', updated: 'react:5' },
  { id: 'wevu-to-native', scope: ['#wevu-parent-component', '#wevu-parent-native'], owner: ['#wevu-parent-component'], action: '#native-leaf-action', value: 5, result: '#wevu-native-result', updated: 'native:6' },
  { id: 'wevu-to-react', scope: ['#wevu-parent-component', '#wevu-parent-react'], owner: ['#wevu-parent-component'], action: '#react-leaf-action', value: 6, result: '#wevu-react-result', updated: 'react:7' },
]

export function interopCheckpoint(completed: number, provider: DomProvider): DomCheckpoint {
  const edge = INTEROP_EDGES[completed - 1]
  return {
    id: edge?.id ?? 'initial',
    route: INTEROP_ROUTE,
    action: edge ? `点击 ${edge.id} 子组件按钮并检查父组件结果，其余互操作结果保持不变` : '首屏检查六条互操作边的 props 文本、默认插槽和 idle 结果',
    nodes: [
      { selector: '.interop-title', text: 'React + Wevu + Native' },
      ...INTEROP_EDGES.flatMap((item, index): DomNodeExpectation[] => [
        { selector: '.leaf-label', scope: item.scope, text: `${item.id}:${item.value}` },
        {
          selector: `#slot-${item.id}`,
          scope: item.owner,
          text: `slot:${item.id}`,
          ...(provider === 'devtools' ? { visible: true, styles: { width: '160px', height: '24px' } } : {}),
        },
        { selector: item.result, scope: item.owner, text: index < completed ? item.updated : 'idle' },
      ]),
    ],
  }
}

export async function reactControl(page: any, selector: string, scope: string[] = []) {
  let owner = page
  for (const boundary of scope) {
    const matches = await owner.$$(boundary, { fallback: false, timeout: 5_000 })
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one React component boundary: ${boundary}`)
    }
    owner = matches[0]
  }
  const elements = await owner.$$(selector, { fallback: false, timeout: 5_000 })
  if (elements.length !== 1) {
    throw new Error(`Expected exactly one React control: ${selector}`)
  }
  return elements[0]
}
