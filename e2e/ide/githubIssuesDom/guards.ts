import type { DomCheckpoint } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

export const GUARD_ROUTE = '/pages/issue-911/index'
export const GUARD_RESULT_ROUTE = '/pages/issue-911-result/index'
export const OTHER_ROUTE = '/pages/issue-550/index'

function report(id: string, mode: string, trace: string[]): DomCheckpoint {
  return { id, route: GUARD_RESULT_ROUTE, action: `呈现 ${mode} 场景的实际 guard 执行轨迹`, nodes: [
    text('#issue911-result-title', 'issue-911 guard result'),
    text('#issue911-result-mode', `mode: ${mode}`),
    text('#issue911-result-mounted', `mounted: ${trace.filter(entry => entry === 'mounted').length}`),
    { selector: '.issue911-trace', count: trace.length },
    ...trace.map((entry, index) => text(`#issue911-trace-${index}`, entry)),
  ] }
}

function mounted(trace: string[]): DomCheckpoint {
  return { id: 'mounted', route: GUARD_ROUTE, action: '检查 guard 完成后目标页面的挂载结果和执行顺序', nodes: [
    text('#issue911-title', 'issue-911 async guard'),
    text('#issue911-mounted-trace', trace.join(' > ')),
  ] }
}

function other(id: string): DomCheckpoint {
  return { id, route: OTHER_ROUTE, action: '检查普通页面已渲染且旧目标内容不存在', nodes: [
    text('.issue550-probe', 'route name = pages/issue-550/index'),
    { selector: '#issue-911-page', count: 0 },
  ] }
}

const completeTrace = ['beforeEach:start', 'beforeEach:done', 'mounted']
const redirectTrace = ['beforeEach:start', 'beforeEach:done', 'redirect', ...completeTrace]
const baseline = report('baseline', 'none', [])

export const GUARD_PLANS = {
  default: [baseline, mounted(completeTrace)],
  redirect: [baseline, mounted(redirectTrace)],
  abort: [baseline, { id: 'blocked', route: GUARD_ROUTE, action: 'guard abort 后目标模板未挂载', nodes: [{ selector: '#issue-911-page', count: 0 }] }, report('result', 'abort', ['beforeEach:start', 'beforeEach:done'])],
  subsequent: [baseline, mounted(completeTrace), other('other')],
  never: [baseline, mounted(['beforeEach:start', 'mounted'])],
  reject: [baseline, { id: 'blocked', route: GUARD_ROUTE, action: 'guard reject 后目标模板未挂载', nodes: [{ selector: '#issue-911-page', count: 0 }] }, report('result', 'reject', ['beforeEach:start', 'beforeEach:done'])],
  late: [baseline, other('replaced'), other('settled'), report('result', 'late', ['beforeEach:start', 'beforeEach:done'])],
} satisfies Record<string, DomCheckpoint[]>
