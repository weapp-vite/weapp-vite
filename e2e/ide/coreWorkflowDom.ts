import type { DomCheckpoint, DomProvider } from '../utils/domAcceptance/types'

export function cliCounterCheckpoint(id: string, count: number, action: string): DomCheckpoint {
  return {
    id,
    route: '/pages/index/index',
    action,
    nodes: [
      { selector: '#count-label', text: `已点击 ${count} 次` },
      { selector: '.count-button-control', scope: ['#count-button'], count: 1 },
    ],
  }
}

export const CLI_WORKFLOW_CHECKPOINTS = [
  cliCounterCheckpoint('initial', 0, 'CLI 打开项目并截图后检查初始计数'),
  cliCounterCheckpoint('cli-tapped', 1, '通过 CLI tap 后检查页面计数递增一次'),
  cliCounterCheckpoint('mcp-tapped', 2, '通过 MCP tap 后检查页面计数再次递增'),
]

export const CLI_HOTKEY_CHECKPOINTS = [
  cliCounterCheckpoint('dev-opened', 0, 'dev -o 启动后检查截图目标页面的首屏内容'),
  cliCounterCheckpoint('screenshot', 0, '截图快捷键完成后检查目标页面内容未变化'),
]

export function sharedStyleCheckpoints(provider: DomProvider): DomCheckpoint[] {
  const pageStyles = provider === 'devtools'
    ? { styles: { 'color': 'rgb(51, 103, 214)', 'border-top-color': 'rgb(15, 118, 110)', 'border-top-width': '2px' }, visible: true }
    : {}
  return [
    {
      id: 'main',
      route: '/pages/index/index',
      action: '检查主包页面文本及共享颜色和边框样式',
      nodes: [{ selector: '#shared-styles-main-page', text: 'main page', ...pageStyles }],
    },
    {
      id: 'subpackage',
      route: '/packageA/pages/foo/index',
      action: '切到普通分包检查共享页面样式和组件内容',
      nodes: [
        { selector: '#shared-styles-normal-page', ...pageStyles },
        { selector: '#shared-styles-normal-component', scope: [{ has: '#shared-styles-normal-component' }], text: 'foo' },
      ],
    },
    {
      id: 'independent',
      route: '/packageB/pages/bar/index',
      action: '切到独立分包检查主包共享样式未泄漏',
      nodes: [{
        selector: '#shared-styles-independent-page',
        text: 'independent',
        ...(provider === 'devtools' ? { styles: { 'color': 'rgb(0, 0, 0)', 'border-top-width': '0px' }, visible: true } : {}),
      }],
    },
  ]
}
