import assert from 'node:assert/strict'
import { it } from 'vitest'
import { isConfirmedBaselineRejection } from './negativeControl.mjs'
import { isOriginalRecoveryRejection } from './validation.mjs'

function originalRejection() {
  return {
    id: 'public-missing-watch-recovery',
    variant: 'baseline',
    status: 'failed',
    code: 1,
    signal: null,
    timedOut: false,
    interrupted: false,
    cleanupConfirmed: true,
    scope: 'completed',
    report: {
      id: 'public-missing-watch-recovery',
      platform: 'win32',
      status: 'failed',
      native: { injected: 1, handles: [{ file: '', closeCalls: 1, closeEvents: 1 }] },
      cleanup: { nativeCleanupConfirmed: true, deletedFixture: true, machineLeaseReleased: true, forcedNativeCloses: [], errors: [] },
      bodyError: { code: 'EPERM', originalInjectedError: true },
      publicErrors: [{ code: 'EPERM', originalInjectedError: true }],
      evidence: { injectedOnce: true, factoryCompleted: true, createEmitted: true, changeEmitted: true, deleteEmitted: true },
    },
  }
}

function serialized(result: unknown): unknown {
  return JSON.parse(JSON.stringify(result)) as unknown
}

it('validation 入口直接复用唯一 pure evaluator，避免两套规则漂移', () => {
  assert.equal(isOriginalRecoveryRejection, isConfirmedBaselineRejection)
})

it('仅接受真实 Windows 完整恢复、原始单例错误和已确认收尾的 baseline', () => {
  assert.equal(isOriginalRecoveryRejection(serialized(originalRejection())), true)
})

it.each([
  ['id', 'other-scenario'],
  ['variant', 'candidate'],
  ['status', 'passed'],
  ['code', 0],
  ['code', 2],
  ['code', null],
  ['signal', 'SIGTERM'],
  ['timedOut', true],
  ['interrupted', true],
  ['launchError', 'child failed to start'],
  ['cleanupConfirmed', false],
  ['scope', 'sealed'],
] as const)('执行字段 %s=%s 不满足原始负控', (key, value) => {
  assert.equal(isOriginalRecoveryRejection(serialized({ ...originalRejection(), [key]: value })), false)
})

it.each([
  ['id', 'other-scenario'],
  ['platform', 'darwin'],
  ['status', 'passed'],
  ['native', { injected: 0 }],
  ['native', { injected: 2 }],
  ['bodyError', { code: 'ERR_ASSERTION', originalInjectedError: false }],
  ['bodyError', { code: 'EPERM', originalInjectedError: false }],
  ['bodyError', { code: 'ENOENT', originalInjectedError: true }],
  ['bodyError', undefined],
  ['publicErrors', []],
  ['publicErrors', [{ code: 'EPERM', originalInjectedError: false }]],
  ['publicErrors', [{ code: 'ENOENT', originalInjectedError: true }]],
  ['publicErrors', [{ code: 'EPERM', originalInjectedError: true }, { code: 'EPERM', originalInjectedError: true }]],
  ['publicErrors', [{ code: 'EPERM', originalInjectedError: true }, { code: 'EPERM', originalInjectedError: false }]],
  ['publicErrors', undefined],
  ['evidence', {}],
] as const)('报告字段 %s 缺失或不匹配时不能只凭 bodyError 标签通过', (key, value) => {
  const result = originalRejection()
  assert.equal(isOriginalRecoveryRejection(serialized({ ...result, report: { ...result.report, [key]: value } })), false)
})

it.each(['injectedOnce', 'factoryCompleted', 'createEmitted', 'changeEmitted', 'deleteEmitted'])('缺少完整恢复证据 %s 时拒绝负控', (key) => {
  const result = originalRejection()
  result.report.evidence = { ...result.report.evidence, [key]: false }
  assert.equal(isOriginalRecoveryRejection(serialized(result)), false)
})

it('worker 未提供报告时保持负控失败', () => {
  assert.equal(isOriginalRecoveryRejection(serialized({ ...originalRejection(), report: undefined })), false)
})
