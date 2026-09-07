import type { DomCheckpoint, DomNodeExpectation, DomProvider } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

export function issueCheckpoint(route: string, id: string, nodes: DomNodeExpectation[], action = id): DomCheckpoint {
  return { route, id, action, nodes }
}

function initial(route: string, nodes: DomNodeExpectation[]) {
  return [issueCheckpoint(`/pages/${route}/index`, 'initial', nodes, '首屏检查实际渲染结果')]
}

function states(route: string, selector: string, before: string, after: string) {
  return [
    issueCheckpoint(`/pages/${route}/index`, 'initial', [text(selector, before)], '首屏检查初始状态'),
    issueCheckpoint(`/pages/${route}/index`, 'updated', [text(selector, after)], '触发生命周期或交互并检查渲染结果'),
  ]
}

export const GITHUB_LIFECYCLE_PLANS = {
  issue309: initial('issue-309', [text('.issue309-title', 'issue-309 onLoad hook'), text('.issue309-count', 'loadCount: 1')]),
  issue309Created: initial('issue-309-created', [text('.issue309-created-title', 'issue-309 created lifecycle onLoad hook'), text('.issue309-created-count', 'loadCount: 1')]),
  issue312: [
    issueCheckpoint('/pages/issue-312/index', 'initial', [text('.issue312-current', 'current option: 选项1'), text('.issue312-index', 'index: 0')]),
    issueCheckpoint('/pages/issue-312/index', 'incremented', [text('.issue312-current', 'current option: 选项2'), text('.issue312-index', 'index: 1')], '切换第二个计算对象'),
    issueCheckpoint('/pages/issue-312/index', 'restored', [text('.issue312-current', 'current option: 选项1'), text('.issue312-index', 'index: 0')], '恢复最初对象引用'),
  ],
  issue316: states('issue-316', '#issue316-probe', 'overlay clicks: 0', 'overlay clicks: 1'),
  issue318: [
    issueCheckpoint('/pages/issue-318/index', 'initial', [
      text('.issue318-probe', 'count: 1 | size: 2 | active: row-0:Alpha'),
      text('.issue318-meta', 'meta-1-2'),
      { selector: '.issue318-row', count: 2 },
    ]),
    issueCheckpoint('/pages/issue-318/index', 'updated', [
      text('.issue318-probe', 'count: 2 | size: 3 | active: row-1:Beta'),
      text('.issue318-meta', 'meta-2-3'),
      text('#issue318-row-2 .issue318-row-text', 'row-2:Extra-2'),
      { selector: '.issue318-row', count: 3 },
    ], '递增、追加列表并切换激活项'),
  ],
  issue320: [
    issueCheckpoint('/pages/issue-320/index', 'initial', [text('.issue320-title', 'issue-320 dynamic route alias + redirect'), text('.issue320-nav-trigger', 'run redirect navigation e2e')]),
    issueCheckpoint('/pages/issue-309/index', 'redirected', [text('.issue309-title', 'issue-309 onLoad hook'), text('.issue309-count', 'loadCount: 1')], '运行动态 alias/redirect 并验收目标页面'),
  ],
  issue380: initial('issue-380', [
    text('.issue-380-page', 'issue-380 page'),
    { selector: '//*[contains(@class, "issue-380-custom-tab-bar")]', query: 'xpath', text: 'issue-380 custom tab bar' },
    { selector: '//*[@id="github-issues-default-layout"][descendant::*[contains(@class, "issue-380-custom-tab-bar")]]', query: 'xpath', count: 0 },
  ]),
  issue385: initial('issue-385', [
    text('.issue385-attach-probe', 'attach-count: 1', ['#attach-probe']),
    { selector: 'component', has: '#github-issues-default-layout', count: 1 },
  ]),
  issue398: initial('issue-398', [
    text('.issue-398-page__title', 'issue-398 hmr shared chunk'),
    text('.issue-398-page__marker', 'issue-398-page-initial'),
    text('.issue-398-navbar', 'issue-398 navbar', [{ has: '.issue-398-shell' }, '#issue398-navbar']),
    text('.issue-398-footer', 'issue-398 footer', [{ has: '.issue-398-shell' }, '#issue398-footer']),
  ]),
  issue404: [
    issueCheckpoint('/pages/issue-404/index', 'initial', [text('.issue404-hook-state', 'has instance onPageScroll: yes'), { selector: '.issue404-filler', count: 48 }]),
    issueCheckpoint('/pages/issue-404/index', 'updated', [text('.issue404-hook-state', 'has instance onPageScroll: yes'), text('.issue404-scroll-top', 'latest scrollTop: 960')], '调用真实 onPageScroll 桥接并呈现位置'),
  ],
  issue418419: initial('issue-418-419', [
    text('#issue418419-mounted', 'mounted: yes'),
    text('#issue418419-ready', 'native ref ready: yes'),
    text('#issue418419-label', 'native label: issue-418-419'),
  ]),
  issue446: initial('issue-446', [
    text('#issue446-anchor', 'native anchor'),
    text('.issue446-probe__visible', 'visible', [{ has: '.issue446-probe' }]),
    text('.issue446-probe__foo', 'issue-446-short-bind', [{ has: '.issue446-probe' }]),
  ]),
  issue479Pull: states('issue-479', '.issue479-logs', 'logs: empty', 'logs: pull'),
  issue479Bottom: states('issue-479', '.issue479-logs', 'logs: empty', 'logs: bottom'),
  issue695: [
    issueCheckpoint('/pages/issue-695/index', 'initial', [text('.issue695-count', 'count: 0 doubled: 0'), text('.issue695-logs', 'logs: empty')]),
    issueCheckpoint('/pages/issue-695/index', 'updated', [text('.issue695-count', 'count: 1 doubled: 2'), text('.issue695-logs', 'logs: pull:1')], '触发直接注册的下拉刷新 hook'),
  ],
  blockSlot: [
    issueCheckpoint('/pages/block-slot/index', 'initial', [text('.block-slot-header-probe', 'header slot via block: ready'), text('.block-slot-default-probe', 'default slot via block: alpha'), text('.block-slot-header-extra', 'header extra')]),
    issueCheckpoint('/pages/block-slot/index', 'updated', [text('.block-slot-header-probe', 'header slot via block: updated'), text('.block-slot-default-probe', 'default slot via block: beta'), text('.block-slot-header-extra', 'header extra')], '更新 block 投影的具名和默认内容'),
  ],
  issue494: [
    issueCheckpoint('/pages/issue-494/index', 'initial', [text('.issue494-header-probe', 'header via template slot: ready'), text('.issue494-default-probe', 'default via template slot: alpha'), { selector: '.issue494-icon-probe', attributes: { src: 'https://static.example.com/issue-494/icon.png' } }]),
    issueCheckpoint('/pages/issue-494/index', 'updated', [text('.issue494-header-probe', 'header via template slot: updated'), text('.issue494-default-probe', 'default via template slot: beta'), text('.issue494-header-extra', 'header extra')], '更新 template v-slot 投影文本'),
  ],
  issue500: initial('issue-500', [text('.issue500-status', 'inject after line: continued')]),
  slotTag: [false, true].map(updated => issueCheckpoint('/pages/slot-tag-form/index', updated ? 'updated' : 'initial', [
    text('.slot-tag-form-self-header', `self header: ${updated ? 'updated' : 'ready'}`),
    text('.slot-tag-form-self-body', `self body: ${updated ? 'beta' : 'alpha'}`),
    text('.slot-tag-form-paired-header', `paired header: ${updated ? 'updated' : 'ready'}`),
    text('.slot-tag-form-paired-body', `paired body: ${updated ? 'beta' : 'alpha'}`),
  ], updated ? '更新两种 slot 标签形式的内容' : '首屏检查两种 slot 标签形式的投影')),
  issue373: [
    issueCheckpoint('/pages/issue-373/launch/index', 'initial', [text('.issue373-launch-count', 'launch count: 1'), text('.issue373-launch-double', 'launch doubled: 2')]),
    issueCheckpoint('/pages/issue-373/result/index', 'relaunch', [text('.issue373-result-count', 'result count: 1'), text('.issue373-result-double', 'result doubled: 2')], 'reLaunch 后保留共享 store'),
    issueCheckpoint('/pages/issue-373/result/index', 'incremented', [text('.issue373-result-count', 'result count: 2'), text('.issue373-result-double', 'result doubled: 4')], '卸载首个页面后更新共享 store'),
  ],
} satisfies Record<string, DomCheckpoint[]>

export function slotFlexCheckpoint(provider: DomProvider): DomCheckpoint[] {
  const items = [
    ['single-left', 'L1'],
    ['single-middle', 'M1'],
    ['single-right', 'R1'],
    ['middle-multi-left', 'L1'],
    ['middle-multi-center-a', 'M1'],
    ['middle-multi-center-b', 'M2'],
    ['middle-multi-right', 'R1'],
    ['all-multi-left-a', 'L1'],
    ['all-multi-left-b', 'L2'],
    ['all-multi-middle-a', 'M1'],
    ['all-multi-middle-b', 'M2'],
    ['all-multi-right-a', 'R1'],
    ['all-multi-right-b', 'R2'],
  ]
  return initial('slot-flex-layout', [
    ...['single', 'middle-multi', 'all-multi'].map((key): DomNodeExpectation => ({
      selector: '.slot-flex-host',
      scope: [`#slot-flex-${key}`],
      ...(provider === 'devtools' ? { styles: { 'display': 'flex', 'flex-wrap': 'nowrap' }, visible: true } : {}),
    })),
    ...items.map(([key, value]): DomNodeExpectation => ({
      selector: `.slot-flex-item--${key}`,
      text: value,
      ...(provider === 'devtools' ? { visible: true } : {}),
    })),
    { selector: '.slot-flex-item', count: 13 },
  ])
}
