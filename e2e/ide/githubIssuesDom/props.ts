import type { DomCheckpoint, DomNodeExpectation, DomProvider } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

function checkpoint(issue: number, id: string, nodes: DomNodeExpectation[], action: string): DomCheckpoint {
  return { id, route: `/pages/issue-${issue}/index`, nodes, action }
}

export function propsCheckpoints(provider: DomProvider) {
  return {
    issue322: ['initial', 'error', 'cleared'].map(id => checkpoint(322, id, [
      text('.issue322-probe', `state: ${id === 'error' ? 'invalid email' : 'none'}`),
      { selector: '.issue322-input.issue322-input-base', count: 1 },
      { selector: '.issue322-input-error', count: id === 'error' ? 1 : 0 },
      { selector: '.issue322-error-tip', text: 'email error visible', ...(provider === 'devtools' ? { visible: id === 'error' } : {}) },
    ], id === 'initial' ? '首次 errors 未初始化时保留静态 class 并隐藏提示' : id === 'error' ? '设置错误并显示红色提示' : '清除错误并恢复初始 class')),
    issue300: ['initial', 'toggled'].map(id => checkpoint(300, id, [
      text('.issue300-toggle-bool', `toggle bool: ${id === 'initial'}`),
      ...[['primitive', 'Hello'], ['ref-object', 'RefHello'], ['reactive-object', 'ReactiveHello']].flatMap(([key, label]) => [
        text('.issue300-probe-destructured', `destructured: ${label} ${id === 'initial'}`, [`#issue300-${key}`]),
        text('.issue300-probe-props', `props: ${label} ${id === 'initial'}`, [`#issue300-${key}`]),
        text('.issue300-probe-computed', `computed: ${id === 'initial'} / ${id === 'initial'}`, [`#issue300-${key}`]),
        text('.issue300-strict-probe', `${label} ${id === 'initial'}`, [`#issue300-strict-${key}`]),
      ]),
    ], id === 'initial' ? '首屏检查三种来源的 props 和解构值' : '切换布尔值后检查六个子组件同步更新')),
    issue328: [
      checkpoint(328, 'initial', [text('.issue328-value', '111', [{ has: '.issue328-probe' }]), text('.issue328-history', '111', [{ has: '.issue328-probe' }])], '检查首次传入 ref 不经过默认值'),
      checkpoint(328, 'updated', [text('.issue328-value', '222', [{ has: '.issue328-probe' }]), text('.issue328-history', '111|222', [{ has: '.issue328-probe' }])], '更新 ref 后检查值与 watch 历史'),
    ],
    issue955: [
      ['initial', 'string:SALE|string:', 'null', 'SALE', '', ''],
      ['number', 'number:42|string:number.png', 'string:number-label', '42', 'number.png', 'number-label'],
      ['null', 'number:0|string:', 'null', '0', '', ''],
      ['undefined', 'number:0|string:', 'null', '0', '', ''],
      ['string', 'string:PROMO|string:string.png', 'string:string-label', 'PROMO', 'string.png', 'string-label'],
    ].map(([id, summary, nullableType, content, src, nullable]) => checkpoint(955, id!, [
      text('.issue955-probe__summary', summary!, [{ has: '.issue955-probe' }]),
      text('.issue955-probe__nullable-type', nullableType!, [{ has: '.issue955-probe' }]),
      text('.issue955-probe__initial', 'string:SALE|string:', [{ has: '.issue955-probe' }]),
      text('.issue955-probe__content', content!, [{ has: '.issue955-probe' }]),
      text('.issue955-probe__src', src!, [{ has: '.issue955-probe' }]),
      text('.issue955-probe__nullable', nullable!, [{ has: '.issue955-probe' }]),
    ], `检查 ${id} 值经过宿主 properties 后的实际渲染和类型`)),
    issue597: [
      checkpoint(597, 'initial', [text('.issue597-header-a', 'header if branch'), { selector: '.issue597-header-b', count: 0 }], '首屏渲染 if 具名插槽'),
      checkpoint(597, 'else', [text('.issue597-header-b', 'header else branch'), { selector: '.issue597-header-a', count: 0 }], '切换 else 具名插槽并卸载 if 内容'),
    ],
    issue613: [checkpoint(613, 'initial', [
      text('#issue613-virtual-host', 'issue-613 forwarded via compiled virtual host'),
      text('#issue613-footer', 'issue-613 forwarded via compiled footer'),
      text('#issue613-view', 'issue-613 forwarded via compiled view'),
      text('#issue613-native-block', 'issue-613 forwarded via native block'),
      { selector: '.issue613-forwarded-content', count: 4 },
    ], '检查 virtualHost、view 和 native block 转发的默认与具名文本')],
    issue599: [checkpoint(599, 'initial', [{
      ...text('.issue599-probe', 'issue-599 data prop computed', [{ has: '.issue599-probe' }]),
      ...(provider === 'devtools' ? { styles: { color: 'rgb(22, 119, 255)' }, visible: true } : {}),
    }], '检查名为 data 的 prop 在文本和计算样式中的结果')],
    issue600: [true, false].map(alias => checkpoint(600, alias ? 'alias' : 'default', [
      text('.issue600-probe-value', alias ? 'issue-600-alias' : 'issue-600-default'),
      text('.issue600-probe-summary', alias ? 'issue-600-alias|issue-600-setup|alias-ready|setup-ready' : 'issue-600-default|issue-600-setup|alias-fallback|setup-ready'),
      text('.issue600-setup-probe', 'issue-600-setup'),
      text(alias ? '.issue600-guard--if' : '.issue600-guard--else', alias ? 'guard-if' : 'guard-else'),
      { selector: alias ? '.issue600-guard--else' : '.issue600-guard--if', count: 0 },
      { selector: alias ? '.issue600-probe.alias-ready' : '.issue600-probe.alias-fallback', ...(provider === 'devtools' ? { styles: { color: alias ? 'rgb(22, 119, 255)' : 'rgb(71, 85, 105)' }, visible: true } : {}) },
    ], alias ? '带 x 查询参数启动后检查别名和 guard 分支' : '无查询参数重启后检查默认值和 fallback 分支')),
  }
}
