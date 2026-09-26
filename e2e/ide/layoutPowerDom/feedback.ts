import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'
import { expect } from 'vitest'
import { classText, tapRendered, xpathClass } from '../tdesignDom'

export const LAYOUT_POWER_FIXTURE = 'apps/layout-power-demo'
export const INDEX_ROUTE = '/pages/index/index'
export const INITIAL_DESCRIPTION = '页面内容保留，只替换布局、属性和骨架。'
export const UPDATED_DESCRIPTION = '页面内容保留，模板内容已热更新。'
export const UPDATED_POSTER_TITLE = '热更新海报外壳'

export const LAYOUT_EXPECTATIONS = [
  { layout: 'default', label: '默认', title: '默认外壳', mode: '基础样式', message: '默认外壳：顶部轻提示', toast: '默认布局已响应', messageTheme: 'info', toastTheme: 'success', toastPlacement: 'middle', toastDirection: 'row' },
  { layout: 'command', label: '命令', title: '命令外壳', mode: '运行切换', message: '命令外壳：队列已写入', toast: '执行 layout:command', messageTheme: 'warning', toastTheme: 'loading', toastPlacement: 'top', toastDirection: 'column' },
  { layout: 'studio', label: '画室', title: '画室外壳', mode: '工具面板', message: '画室外壳：工具状态已同步', toast: '画板已刷新', messageTheme: 'success', toastTheme: 'success', toastPlacement: 'bottom', toastDirection: 'column' },
  { layout: 'split', label: '分栏', title: '分栏外壳', mode: '区域组合', message: '分栏外壳：区域提示保留 2 秒', toast: '右侧区域已定位', messageTheme: 'warning', toastTheme: 'warning', toastPlacement: 'middle', toastDirection: 'row' },
  { layout: 'poster', label: '海报', title: '海报外壳', mode: '票据样式', message: '海报外壳：长文案沿顶部滚动展示', toast: '票据效果已盖章', messageTheme: 'error', toastTheme: 'error', toastPlacement: 'bottom', toastDirection: 'column' },
] as const

type Layout = typeof LAYOUT_EXPECTATIONS[number]['layout']
interface LayoutStateOptions {
  description?: string
  posterTitle?: string
}

export function layoutStateNodes(layout: Layout, events: number, options: LayoutStateOptions = {}): DomNodeExpectation[] {
  const expected = LAYOUT_EXPECTATIONS.find(item => item.layout === layout)!
  const title = layout === 'poster' ? options.posterTitle ?? expected.title : expected.title
  return [
    classText('summary__name', '切换外壳'),
    classText('summary__layout', expected.label),
    classText('summary__count', `${events} 次`),
    classText('stage__title', title),
    classText('stage__mode', expected.mode),
    classText('stage__desc', options.description ?? INITIAL_DESCRIPTION),
    classText('theme-layout__title', title),
    classText('switch--active', expected.label),
    { selector: xpathClass('switch'), query: 'xpath', count: 5 },
    { selector: xpathClass('feedback-trigger'), query: 'xpath', count: 2 },
  ]
}

export function layoutStateCheckpoint(id: string, action: string, layout: Layout, events: number, options: LayoutStateOptions = {}): DomCheckpoint {
  return { id, action, route: INDEX_ROUTE, nodes: layoutStateNodes(layout, events, options) }
}

export function feedbackRoundCheckpoints(prefix: string, repeats: number, options: LayoutStateOptions = {}): DomCheckpoint[] {
  return Array.from({ length: repeats }, (_, repeat) => LAYOUT_EXPECTATIONS.flatMap((layout, index) => {
    const id = `${prefix}-${repeat + 1}-${layout.layout}`
    const events = repeat * LAYOUT_EXPECTATIONS.length + index + 1
    return [
      layoutStateCheckpoint(`${id}-switched`, `第 ${repeat + 1} 轮切换 ${layout.label} 布局`, layout.layout, events, options),
      {
        id: `${id}-message`,
        route: INDEX_ROUTE,
        action: `点击 ${layout.label} Message 并检查实际文案和主题`,
        nodes: [classText('t-message__text', layout.message), { selector: xpathClass(`t-message--${layout.messageTheme}`), query: 'xpath', count: 1 }],
      },
      {
        id: `${id}-toast`,
        route: INDEX_ROUTE,
        action: `点击 ${layout.label} Toast 并检查实际文案、主题和方向`,
        nodes: [
          classText('t-toast__text', layout.toast),
          { selector: xpathClass(`t-toast--${layout.toastTheme}`), query: 'xpath', count: 1 },
          { selector: xpathClass(`t-toast--${layout.toastDirection}`), query: 'xpath', count: 1 },
        ],
      },
      {
        id: `${id}-closed`,
        route: INDEX_ROUTE,
        action: `${layout.label} 反馈自动关闭后检查没有残留节点`,
        nodes: [
          { selector: xpathClass('t-message__text'), query: 'xpath', count: 0 },
          { selector: xpathClass('t-toast__text'), query: 'xpath', count: 0 },
          classText('summary__count', `${events} 次`),
        ],
      },
    ] satisfies DomCheckpoint[]
  })).flat()
}

interface Acceptance { check: (id: string, session: any, page: any, timeout?: number) => Promise<unknown> }

export async function switchRenderedLayout(page: any, layout: Layout) {
  await tapRendered(page, `${xpathClass('switch')}[@data-layout="${layout}"]`)
}

export async function runFeedbackRounds(acceptance: Acceptance, miniProgram: any, page: any, prefix: string, repeats: number) {
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const layout of LAYOUT_EXPECTATIONS) {
      const id = `${prefix}-${repeat + 1}-${layout.layout}`
      await switchRenderedLayout(page, layout.layout)
      await acceptance.check(`${id}-switched`, miniProgram, page)
      for (const feedback of ['message', 'toast'] as const) {
        await tapRendered(page, `${xpathClass('feedback-trigger')}[@data-e2e-feedback="${feedback}"]`)
        await acceptance.check(`${id}-${feedback}`, miniProgram, page)
        await expect.poll(() => page.data('lastFeedbackResult')).toMatchObject({
          layout: layout.layout,
          feedback,
          messageTheme: layout.messageTheme,
          toastTheme: layout.toastTheme,
          toastPlacement: layout.toastPlacement,
          toastDirection: layout.toastDirection,
          ok: true,
        })
        expect((await page.data('lastFeedbackResult')).messageOffsetTop).toBeGreaterThan(70)
      }
      await acceptance.check(`${id}-closed`, miniProgram, page)
    }
  }
}
