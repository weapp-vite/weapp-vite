import type { DiagnosticEvidence, DiagnosticEvidenceInput } from './types'
import { duplicateMeasurement, measuredBytes } from '../analyzeDataModules'
import {
  budgetPreviousBytes,
  collectArtifacts,
  collectSources,
  deltaBytes,
  duplicatePreviousBytes,
  moduleMeasurement,
  resolveTarget,
} from './helpers'

export type { DiagnosticArtifact, DiagnosticEvidence, DiagnosticEvidenceInput, DiagnosticSource } from './types'

/** 从选中问题的真实报告范围生成证据，不把不同粒度的体积叠加。 */
export function createDiagnosticEvidence(input: DiagnosticEvidenceInput): DiagnosticEvidence {
  const { action, result, previous } = input
  const target = resolveTarget(input)
  const artifacts = collectArtifacts(result, previous, target)
  const sources = collectSources(result, artifacts, target.moduleId)
  const evidence: DiagnosticEvidence = {
    classification: 'unknown',
    scopeLabel: target.label,
    currentBytes: null,
    previousBytes: null,
    deltaBytes: null,
    limitBytes: null,
    measurement: 'unavailable',
    artifacts: artifacts.slice(0, 12),
    artifactCount: artifacts.length,
    sources: sources.slice(0, 16),
    sourceCount: sources.length,
    constraints: [
      '包、产物、模块是重叠粒度，不能相加为总增长或总收益；产物行按包内位置计数，总包预算按共享规则对输出路径去重。',
      '来源行保留真实包／产物／模块位置；同一模块可出现多次，不代表多条独立依赖链。缺测为未知，不是 0。',
      '来源只证明报告记录的关联，不证明当前源码、完整依赖链或可安全删除；源码需要另行读取验证。',
    ],
    steps: [],
    checks: [
      '拟议：经授权后使用项目原生构建链重新构建，读取新报告核对同一目标及测量口径。',
      '拟议：检查受影响页面、分包加载和真实运行时行为，再判断是否解决；本上下文没有执行这些检查。',
    ],
  }
  if (!previous) {
    evidence.constraints.push('浏览器未提供比较报告，previousBytes / deltaBytes 均未知，不能推断新增或增长。')
  }
  if (target.budget) {
    const budget = target.budget
    evidence.currentBytes = budget.status === 'unknown' ? null : measuredBytes(budget.currentBytes)
    evidence.previousBytes = budgetPreviousBytes(previous, budget)
    evidence.limitBytes = measuredBytes(budget.limitBytes)
    evidence.measurement = budget.measurement
    evidence.classification = evidence.currentBytes === null ? 'unknown' : budget.status === 'exceeded' ? 'problem' : budget.status === 'warning' ? 'risk' : 'clue'
    evidence.steps.push('先核对预算范围、阈值和缺测项，再查看该范围的产物与来源，提出需要源码证明的改动假设。')
    evidence.checks.unshift('拟议：复验同一预算范围的完整测量与实际阈值，不能用其他包或全局汇总替代目标范围。')
    if (budget.scope === 'runtime') {
      evidence.constraints.push('Runtime 是包含混合 chunk 的文件体积上界，不是运行时代码净体积；只列共享预算规则认定的相关文件，不能视为一个分包。')
    }
  }
  else if (action.kind === 'duplicate' && target.moduleId !== undefined) {
    const duplicate = input.duplicateModules.find(module => module.id === target.moduleId)
    evidence.currentBytes = duplicateMeasurement(result, target.moduleId, duplicate?.estimatedSavingBytes)
    evidence.previousBytes = duplicatePreviousBytes(previous, target.moduleId)
    evidence.measurement = 'upper-bound'
    evidence.classification = evidence.currentBytes === null ? 'unknown' : 'clue'
    evidence.constraints.push('当前值是共享规则的重复体积估算上界，不是全部副本的总量，也不是保证可节省的字节；差值只比较重复估算。')
    if (result.modules.find(module => module.id === target.moduleId)?.packages.some(placement => result.packages.some(pkg => pkg.id === placement.packageId && pkg.type === 'independent'))) {
      evidence.constraints.push('包含独立分包，重复可能是隔离要求；不能直接假定可移入主包或删除副本。')
    }
    evidence.steps.push('逐个核对真实产物位置和源码引用边界，先确认独立分包隔离与加载约束，再评估是否有可合并的重复。')
    evidence.checks.unshift('拟议：对比重建前后的真实产物体积和重复位置，同时验证各分包独立运行；不要把估算值当作验收收益。')
  }
  else if (action.kind === 'increment' && target.moduleId !== undefined) {
    Object.assign(evidence, moduleMeasurement(input, target.moduleId))
    evidence.measurement = evidence.currentBytes === null ? 'unavailable' : 'upper-bound'
    evidence.classification = evidence.currentBytes === null || evidence.deltaBytes === null ? 'unknown' : 'clue'
    evidence.constraints.push('模块按共享比较规则匹配规范来源，取记录贡献的最大值（可回落到原始体积），不是最终文件净增量；产物行仅作关联对照。')
  }
  else if (action.kind === 'increment') {
    const artifact = artifacts.find(item => item.entry.packageId === target.packageId && item.entry.file === target.file)
    if (artifact) {
      evidence.currentBytes = artifact.bytes
      evidence.previousBytes = artifact.previousBytes
      evidence.measurement = artifact.bytes === null ? 'unavailable' : 'file-bytes'
      evidence.classification = artifact.bytes === null || artifact.deltaBytes === null ? 'unknown' : 'clue'
    }
  }
  evidence.deltaBytes = deltaBytes(evidence.currentBytes, evidence.previousBytes)
  if (action.kind === 'increment') {
    evidence.steps.push('核对浏览器比较报告的来源，再按所选文件或模块粒度定位变化；增长本身不是错误，优化原因仍是假设。')
    evidence.checks.unshift('拟议：在可核对的同一比较基线上检查目标差值；没有基线或存在缺测时保持未知，不宣称增长已消除。')
  }
  if (evidence.classification === 'unknown') {
    evidence.steps.unshift('先补全目标定位、测量或比较基线；在事实不足时只列待确认项，不给出确定修复结论。')
  }
  return evidence
}
