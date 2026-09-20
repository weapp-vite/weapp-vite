import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'

function childText(selector: string, text: string): DomNodeExpectation {
  return { selector, text, scope: ['#function-prop-child'] }
}

function functionPropsCase(id: string, route: string, title: string, calls: string, nodes: DomNodeExpectation[]): DomCheckpoint[] {
  return [
    {
      id: `${id}-initial`,
      route,
      action: '首屏检查函数 prop 子组件尚未被调用及父级调用记录',
      nodes: [
        { selector: '.title', text: title },
        { selector: '#function-prop-calls', text: 'calls: none' },
        childText('#callback-type', 'callback: unset'),
        childText('#handler-type', 'handler: unset'),
        childText('#callback-result', 'callback result: --'),
        childText('#handler-result', 'handler result: --'),
      ],
    },
    {
      id: `${id}-invoked`,
      route,
      action: '通过子组件调用传入函数并检查返回值和父级调用记录',
      nodes: [
        { selector: '#function-prop-calls', text: `calls: ${calls}` },
        ...nodes,
      ],
    },
  ]
}

export const FUNCTION_PROPS_CHECKPOINTS: DomCheckpoint[] = [
  ...functionPropsCase('auto', '/pages/function-props-auto/index', 'Function Props Auto', 'callback:auto,handler:member', [
    childText('#callback-type', 'callback: function'),
    childText('#handler-type', 'handler: function'),
    childText('#callback-result', 'callback result: callback:auto'),
    childText('#handler-result', 'handler result: handler:member'),
    childText('#meta-title', 'meta title: static-member-title'),
    childText('#dynamic-label', 'dynamic label: computed-member-label'),
  ]),
  ...functionPropsCase('disabled', '/pages/function-props-disabled/index', 'Function Props Disabled', 'none', [
    childText('#callback-result', 'callback result: --'),
    childText('#handler-result', 'handler result: --'),
  ]),
  ...functionPropsCase('dynamic', '/pages/function-props-dynamic/index', 'Function Props Dynamic', 'dynamic:opt-in', [
    childText('#callback-type', 'callback: unset'),
    childText('#handler-type', 'handler: function'),
    childText('#callback-result', 'callback result: --'),
    childText('#handler-result', 'handler result: dynamic:opt-in'),
  ]),
  {
    id: 'value-initial',
    route: '/pages/non-function-prop-bind/index',
    action: '检查普通字符串 prop 在子组件中的渲染值',
    nodes: [{ selector: '.selected', scope: ['#data-list'], text: 'user-001' }],
  },
  {
    id: 'value-invoked',
    route: '/pages/non-function-prop-bind/index',
    action: '读取普通 prop 后确认子组件继续显示实际字符串值',
    nodes: [{ selector: '.selected', scope: ['#data-list'], text: 'user-001' }],
  },
]
