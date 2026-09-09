import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

function source(id: string, action: string): DomCheckpoint {
  return { id, action, route: '/pages/issue-705/index', nodes: [
    text('.issue705-title', 'issue-705 router route sync'),
    text('.issue705-route', 'route: pages/issue-705/index'),
    text('.issue705-router-route', 'router: pages/issue-705/index'),
    text('.issue705-push', 'push target'),
  ] }
}

function target(id: string, action: string): DomCheckpoint {
  return { id, action, route: '/pages/issue-550/index', nodes: [
    text('.issue550-title', 'issue-550 useRoute name'),
    text('.issue550-probe', 'route name = pages/issue-550/index'),
  ] }
}

export const ISSUE705_TABS: DomCheckpoint[] = [
  source('initial', '首屏检查源页面路由和导航按钮'),
  target('pushed', 'router.push 后检查目标页面'),
  source('reloaded', 'reLaunch 返回源页面'),
  { id: 'tab', action: '原生 switchTab 后检查 tab 页面路由', route: '/pages/issue-705-tab/index', nodes: [
    text('.issue705-tab-title', 'issue-705 native switchTab target'),
    text('.issue705-tab-route', 'route: pages/issue-705-tab/index'),
  ] },
  target('tab-pushed', '从 tab 页面再次 push 同一目标页面'),
]

export const ISSUE705_BACK = ['router', 'native', 'system'].flatMap(mode => [
  source(`${mode}:initial`, `${mode} 返回场景首屏`),
  target(`${mode}:pushed`, `${mode} 返回场景首次进入目标页面`),
  source(`${mode}:returned`, `${mode} 返回后检查两个路由引用已恢复`),
  target(`${mode}:repushed`, `${mode} 返回后再次进入同一目标页面`),
])
