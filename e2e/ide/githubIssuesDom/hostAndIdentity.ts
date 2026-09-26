import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

export const IDENTITY_CHECKPOINTS: DomCheckpoint[] = [false, true].map(updated => ({
  id: updated ? 'updated' : 'initial',
  route: '/pages/issue-868/index',
  action: updated ? '修改对象后检查原有卡片身份和投影文本' : '检查两张卡片和原始值列表',
  nodes: [
    text('.issue-868-card-title', updated ? 'alpha-updated' : 'alpha', ['#issue-868-card-entry-a']),
    text('.issue-868-card-count', updated ? '1' : '0', ['#issue-868-card-entry-a']),
    text('.issue-868-card-title', 'beta', ['#issue-868-card-entry-b']),
    text('.issue-868-card-count', '0', ['#issue-868-card-entry-b']),
    { selector: '.issue-868-primitive', count: 2 },
    text('#issue868-primitive-a', 'primitive-a'),
    text('#issue868-primitive-b', 'primitive-b'),
  ],
}))

export const SHELL_CHECKPOINTS = {
  default: [{ id: 'initial', route: '/pages/issue-338/index', action: '检查 app shell、默认布局与页面业务内容', nodes: [
    { selector: 'component', has: '#github-issues-app-shell' },
    { selector: 'component', has: '#github-issues-default-layout' },
    text('.issue338-title', 'discussion-338 html tag mapping'),
    { selector: '.issue338-link', count: 2 },
    { selector: '.issue338-cover', attributes: { src: '/assets/issue-338-cover.png', mode: 'aspectFit' } },
  ] }],
  disabled: [{ id: 'initial', route: '/pages/issue-448/index', action: '检查禁用默认布局后保留 app shell 和实际 URL 解析结果', nodes: [
    { selector: 'component', has: '#github-issues-app-shell' },
    { selector: 'component', has: '#github-issues-default-layout', count: 0 },
    text('#issue448-url', 'url = fake://abc/123'),
    text('.issue448-title', 'issue-448 next web runtime globals'),
  ] }],
} satisfies Record<string, DomCheckpoint[]>

export const RESERVED_PROPS_CHECKPOINTS: DomCheckpoint[] = [{
  id: 'initial',
  route: '/pages/issue-627-native/index',
  action: '逐项检查实际 native 和 SFC 属性值的渲染结果',
  nodes: [
    text('.issue627-native-title', 'issue-627 native reserved props'),
    { selector: '.issue627-native-row', count: 14 },
    ...[
      ['id', '', ''],
      ['class', '', ''],
      ['slot', '', ''],
      ['style', 'color: rgb(22, 119, 255);', 'color: rgb(22, 119, 255);'],
      ['hidden', 'false', 'false'],
      ['dataFoo', 'issue-627-native-dataFoo', 'issue-627-sfc-host-dataFoo'],
      ['data-foo', 'issue-627-native-data-foo', 'n/a'],
      ['markFoo', 'issue-627-native-markFoo', 'issue-627-sfc-host-markFoo'],
      ['mark:foo', 'issue-627-native-mark-colon-foo', 'n/a'],
      ['customClass', 'issue-627-native-custom-class', 'issue-627-sfc-host-custom-class'],
      ['customStyle', 'font-size: 32rpx;', 'font-size: 32rpx;'],
      ['customHidden', 'true', 'true'],
      ['customDataFoo', 'issue-627-native-custom-data-foo', 'issue-627-sfc-host-custom-data-foo'],
    ].flatMap(([, native, sfc], index) => [text(`#issue627-native-value-${index}`, native), text(`#issue627-sfc-value-${index}`, sfc)]),
    text('#issue627-dynamic-style', 'font-size: 32rpx;', ['#issue627-sfc-host-dynamic']),
    text('#issue627-dynamic-custom-style', 'color: rgb(22, 119, 255);', ['#issue627-sfc-host-dynamic']),
    text('#issue627-dynamic-data', 'issue-627-sfc-host-dynamic-dataFoo', ['#issue627-sfc-host-dynamic']),
  ],
}]
