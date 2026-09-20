import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'

function layoutNodes(layout: 'default' | 'admin' | 'none'): DomNodeExpectation[] {
  return [
    { selector: '.hero__title', text: '基础模板已接入 src/layouts 约定' },
    { selector: '.hero__desc', text: `当前状态：${layout}。可以在 default、admin 与 false 三种布局模式之间切换，作为正式业务页面的基础壳能力。` },
    { selector: '.section__title', count: 3 },
    { selector: '.action-btn', count: 4 },
    { selector: 'component', has: '.layout-default', count: layout === 'default' ? 1 : 0 },
    { selector: 'component', has: '.layout-admin', count: layout === 'admin' ? 1 : 0 },
    ...(layout === 'admin'
      ? [
          { selector: '.layout-admin__title', scope: [{ has: '.layout-admin' }], text: '业务后台布局' },
          { selector: '.layout-admin__subtitle', scope: [{ has: '.layout-admin' }], text: '这个标题来自 setPageLayout() 传入的 props。' },
        ]
      : []),
  ]
}

export const templateLayoutCheckpoints: DomCheckpoint[] = [
  { id: 'initial', route: '/pages/layouts/index', action: '打开默认布局，检查页面内容与布局宿主', nodes: layoutNodes('default') },
  { id: 'admin', route: '/pages/layouts/index', action: '切换管理布局，检查布局标题、说明及页面状态', nodes: layoutNodes('admin') },
  { id: 'none', route: '/pages/layouts/index', action: '关闭布局，检查两个布局宿主消失且页面内容保留', nodes: layoutNodes('none') },
  { id: 'default', route: '/pages/layouts/index', action: '恢复默认布局，检查页面状态恢复', nodes: layoutNodes('default') },
]
