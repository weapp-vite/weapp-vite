import type { DoctorReport, DoctorRuntimeEvidence, DoctorRuntimeStage } from './types'
import { addDiagnostic } from './report'

const suggestions: Record<DoctorRuntimeStage, string> = {
  'cli-executable': '确认所选 CLI 是可执行文件；不会自动回退到其他安装。',
  'service-listener': '核对所选安装的服务端口与监听状态；TCP 可达不能证明监听者身份。',
  'login-query': '确认所选 CLI 可响应查询；未知结果不能推断未登录。',
  'login-state': '仅在原生查询明确未登录时完成正常登录；其他情况先排查查询链路。',
  'project-connection': '确认目标项目已有可连接的 automator 会话及正确端口，不清理其他项目。',
  'tool-info': '确认目标项目工具协议可用；缺失版本不能归因于编译器。',
  'host-version': '从实际连接宿主取得 IDE 版本，不用 CLI 路径或历史记录代替。',
  'sdk-version': '从实际宿主取得基础库版本，不将项目配置值视为实际运行版本。',
  'current-page': '确认目标项目已打开有效页面；页面快照不代替应用功能 E2E。',
  'session-release': '保留环境现场并检查本次 websocket 释放，不终止共享 IDE。',
}

/** 部分失败保留已有事实，按稳定阶段诊断输出；不推断平台或框架责任。 */
export function appendDoctorRuntimeEvidence(report: DoctorReport, target: string, evidence: DoctorRuntimeEvidence) {
  report.runtime[target] = evidence
  const incomplete = evidence.complete === false || evidence.facts?.some(fact => fact.status === 'failed' || fact.status === 'unknown')
  report.coverage.push({ target, layer: 'runtime', check: 'connected-page-snapshot', status: incomplete ? 'incomplete' : 'complete', reason: incomplete ? '请求的宿主探针没有全部完成，已保留部分事实。' : '仅证明请求的工具信息和当前页面可读取；不代表完整应用功能验收。' })
  for (const fact of evidence.facts ?? []) {
    report.coverage.push({ target, layer: 'runtime', check: fact.stage, status: fact.status === 'passed' ? 'complete' : fact.status === 'not-run' && fact.code === 'not-requested' ? 'not-requested' : 'incomplete', reason: fact.code })
    if (fact.status === 'failed' || fact.status === 'unknown') {
      addDiagnostic(report, {
        ruleId: `doctor/runtime/${fact.stage}`,
        target,
        layer: 'runtime',
        severity: 'warning',
        message: `宿主探针 ${fact.stage}：${fact.code}`,
        evidence: { expected: '取得该阶段明确事实', actual: fact.code },
        responsibility: { owner: 'unknown', confidence: 'suspected' },
        suggestion: suggestions[fact.stage],
      })
    }
  }
}
