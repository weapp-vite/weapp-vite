import type { EffectScope } from 'vue'
import type { DashboardInvestigation, DashboardInvestigationTarget, DashboardReportIdentity } from 'weapp-vite/dashboard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import {
  authorizeDashboardInvestigation,
  cancelDashboardInvestigation,
  createDashboardInvestigation,
  dashboardConnectionStatus,
  dashboardInvestigations,
  dashboardReportIdentity,
  verifyDashboardInvestigation,
} from '../utils/dashboardDevframe'
import { useObjectInvestigation } from './useObjectInvestigation'

vi.mock('../utils/dashboardDevframe', async () => {
  const { shallowRef } = await import('vue')
  return {
    dashboardReportIdentity: shallowRef(null),
    dashboardInvestigations: shallowRef({ version: 0, items: [] }),
    dashboardConnectionStatus: shallowRef('connected'),
    connectDashboardDevframe: vi.fn(),
    createDashboardInvestigation: vi.fn(),
    cancelDashboardInvestigation: vi.fn(),
    authorizeDashboardInvestigation: vi.fn(),
    verifyDashboardInvestigation: vi.fn(),
  }
})

const report: DashboardReportIdentity = { sessionId: 'session-1', revision: 1, reportHash: 'a'.repeat(64) }
const target: DashboardInvestigationTarget = { kind: 'artifact', packageId: 'main', file: 'app.js' }
const scopes: EffectScope[] = []

function createTask(overrides: Partial<DashboardInvestigation> = {}): DashboardInvestigation {
  return {
    id: 'task-1',
    version: 1,
    report: { ...report },
    target: { ...target },
    question: 'Explain the measured size',
    evidence: { label: 'app.js', rawBytes: 512, gzipBytes: null, brotliBytes: null, attributedBytes: null, sourceBytes: null },
    status: 'submitted',
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
    agent: null,
    proposal: null,
    authorization: null,
    receipt: null,
    verification: null,
    ...overrides,
  }
}

function setupInvestigation() {
  const request = shallowRef<DashboardInvestigationTarget | null>({ ...target })
  const requestId = shallowRef(1)
  const scope = effectScope()
  scopes.push(scope)
  const model = scope.run(() => useObjectInvestigation({ request, requestId }))!
  return { model, request, requestId, scope }
}

beforeEach(() => {
  dashboardReportIdentity.value = { ...report }
  dashboardInvestigations.value = { version: 0, items: [] }
  dashboardConnectionStatus.value = 'connected'
  vi.resetAllMocks()
})

afterEach(() => {
  for (const scope of scopes.splice(0)) {
    scope.stop()
  }
})

describe('object investigation draft ownership', () => {
  it('freezes the target and report while browsing and requires an explicit replacement for another request', async () => {
    const { model, request, requestId } = setupInvestigation()
    model.question.value = 'Keep this question'
    const originalDraft = model.draft.value
    request.value = { kind: 'package', packageId: 'other' }
    dashboardReportIdentity.value = { ...report, revision: 2, reportHash: 'b'.repeat(64) }
    await nextTick()
    expect(model.draft.value).toBe(originalDraft)
    expect(model.draft.value).toEqual({ target, report })
    expect(model.question.value).toBe('Keep this question')
    expect(model.canSubmit.value).toBe(false)
    requestId.value += 1
    await nextTick()
    expect(model.draft.value).toBe(originalDraft)
    expect(model.pendingDraft.value?.target).toEqual(request.value)
    model.keepDraft()
    expect(model.pendingDraft.value).toBeNull()
    expect(model.draft.value).toBe(originalDraft)
    model.renewDraft()
    expect(model.draft.value?.target).toEqual(target)
    expect(model.draft.value?.report?.revision).toBe(2)
    expect(model.question.value).toBe('Keep this question')
    expect(model.canSubmit.value).toBe(true)
  })

  it('does not silently attach a disconnected draft after hydration', () => {
    dashboardReportIdentity.value = null
    dashboardConnectionStatus.value = 'disconnected'
    const { model } = setupInvestigation()
    model.question.value = 'Inspect after reconnect'
    expect(model.draft.value?.report).toBeNull()
    dashboardReportIdentity.value = { ...report }
    dashboardConnectionStatus.value = 'connected'
    expect(model.canSubmit.value).toBe(false)
    model.renewDraft()
    expect(model.draft.value?.report).toEqual(report)
    expect(model.canSubmit.value).toBe(true)
  })

  it('retains the editable draft through a failed submission and temporary disconnect', async () => {
    const { model } = setupInvestigation()
    model.question.value = 'Inspect app size'
    const original = model.draft.value
    vi.mocked(createDashboardInvestigation).mockRejectedValueOnce(new Error('connection lost'))
    await model.submitDraft()
    expect(model.draft.value).toBe(original)
    expect(model.question.value).toBe('Inspect app size')
    expect(model.error.value).not.toBe('')
    dashboardConnectionStatus.value = 'disconnected'
    dashboardReportIdentity.value = null
    expect(model.canSubmit.value).toBe(false)
    await model.submitDraft()
    expect(createDashboardInvestigation).toHaveBeenCalledTimes(1)
    dashboardReportIdentity.value = { ...report }
    dashboardConnectionStatus.value = 'connected'
    expect(model.canSubmit.value).toBe(true)
  })

  it('submits frozen context and waits for the backend before selecting a task', async () => {
    const { model } = setupInvestigation()
    model.question.value = '  Inspect app size  '
    const deferred = Promise.withResolvers<DashboardInvestigation>()
    vi.mocked(createDashboardInvestigation).mockReturnValue(deferred.promise)
    const pending = model.submitDraft()
    expect(model.tasks.value).toEqual([])
    expect(model.draft.value).not.toBeNull()
    expect(model.busy.value).toBe(true)
    await model.submitDraft()
    expect(createDashboardInvestigation).toHaveBeenCalledTimes(1)
    expect(createDashboardInvestigation).toHaveBeenCalledWith({ report, target, question: 'Inspect app size' })
    const saved = createTask({ question: 'Inspect app size' })
    dashboardInvestigations.value = { version: 1, items: [saved] }
    deferred.resolve(saved)
    await pending
    expect(model.draft.value).toBeNull()
    expect(model.selectedTask.value).toEqual(saved)
    expect(model.busy.value).toBe(false)
  })

  it('does not let a late response clear a draft or select tasks in a new session', async () => {
    const { model } = setupInvestigation()
    model.question.value = 'Keep me'
    const deferred = Promise.withResolvers<DashboardInvestigation>()
    vi.mocked(createDashboardInvestigation).mockReturnValue(deferred.promise)
    const pending = model.submitDraft()
    dashboardReportIdentity.value = { ...report, sessionId: 'session-2' }
    dashboardInvestigations.value = { version: 0, items: [] }
    deferred.resolve(createTask())
    await pending
    expect(model.draft.value?.report).toEqual(report)
    expect(model.question.value).toBe('Keep me')
    expect(model.selectedId.value).toBeNull()
    expect(model.tasks.value).toEqual([])
  })

  it('keeps a newer explicit selection when an earlier create request finishes', async () => {
    const existing = createTask({ id: 'existing' })
    dashboardInvestigations.value = { version: 1, items: [existing] }
    const { model } = setupInvestigation()
    model.question.value = 'New question'
    const deferred = Promise.withResolvers<DashboardInvestigation>()
    vi.mocked(createDashboardInvestigation).mockReturnValue(deferred.promise)
    const pending = model.submitDraft()
    model.selectTask(existing.id)
    const saved = createTask()
    dashboardInvestigations.value = { version: 2, items: [existing, saved] }
    deferred.resolve(saved)
    await pending
    expect(model.selectedId.value).toBe(existing.id)
    expect(model.selectedTask.value).toEqual(existing)
    expect(model.notice.value).toBe('')
  })

  it('cancels a local draft without calling a remote mutation', () => {
    const { model } = setupInvestigation()
    model.question.value = 'Local only'
    model.cancelDraft()
    expect(model.draft.value).toBeNull()
    expect(model.question.value).toBe('')
    expect(createDashboardInvestigation).not.toHaveBeenCalled()
    expect(cancelDashboardInvestigation).not.toHaveBeenCalled()
  })

  it('clears cancelled-draft feedback before presenting a new draft or another task', async () => {
    const task = createTask()
    dashboardInvestigations.value = { version: 1, items: [task] }
    const { model, request, requestId } = setupInvestigation()
    model.question.value = 'Discard this question'
    model.cancelDraft()
    request.value = { kind: 'package', packageId: 'other' }
    requestId.value += 1
    await nextTick()
    expect(model.draft.value?.target).toEqual(request.value)
    expect(model.question.value).toBe('')
    expect(model.notice.value).toBe('')
    model.cancelDraft()
    model.selectTask(task.id)
    expect(model.selectedTask.value).toEqual(task)
    expect(model.notice.value).toBe('')
  })
})

describe('proposal authorization and human verification', () => {
  it('requires explicit confirmation of the exact proposal and invalidates it on replacement or report change', async () => {
    const proposal = { id: 'proposal-1', summary: 'Deduplicate', changes: [{ path: 'src/app.ts', description: 'Remove duplicate work' }], checks: ['focused test'], risks: ['Check startup order'] }
    const task = createTask({ status: 'proposed', version: 3, proposal })
    dashboardInvestigations.value = { version: 3, items: [task] }
    const { model } = setupInvestigation()
    model.selectTask(task.id)
    await model.authorizeProposal()
    expect(authorizeDashboardInvestigation).not.toHaveBeenCalled()
    model.confirmAuthorization(true)
    expect(model.authorization.value).toEqual({ id: task.id, version: 3, proposalId: 'proposal-1' })
    const replacement = { ...task, version: 4, proposal: { ...proposal, id: 'proposal-2' } }
    dashboardInvestigations.value = { version: 4, items: [replacement] }
    expect(model.authorization.value).toBeNull()
    await model.authorizeProposal()
    expect(authorizeDashboardInvestigation).not.toHaveBeenCalled()
    model.confirmAuthorization(true)
    vi.mocked(authorizeDashboardInvestigation).mockResolvedValue({ ...replacement, status: 'authorized', version: 5 })
    await model.authorizeProposal()
    expect(authorizeDashboardInvestigation).toHaveBeenCalledWith({ id: task.id, version: 4, proposalId: 'proposal-2' })
    dashboardReportIdentity.value = { ...report, revision: 2 }
    expect(model.authorization.value).toBeNull()
    expect(model.canAuthorize.value).toBe(false)
  })

  it('sends only scoped cancellation while preserving server-owned state until confirmation', async () => {
    const task = createTask({ status: 'executing', version: 5 })
    dashboardInvestigations.value = { version: 5, items: [task] }
    const { model } = setupInvestigation()
    model.selectTask(task.id)
    const deferred = Promise.withResolvers<DashboardInvestigation>()
    vi.mocked(cancelDashboardInvestigation).mockReturnValue(deferred.promise)
    const pending = model.cancelTask()
    expect(cancelDashboardInvestigation).toHaveBeenCalledWith({ id: task.id, version: 5 })
    expect(model.selectedTask.value?.status).toBe('executing')
    const cancelled: DashboardInvestigation = { ...task, status: 'cancelled', version: 6 }
    dashboardInvestigations.value = { version: 6, items: [cancelled] }
    deferred.resolve(cancelled)
    await pending
    expect(model.selectedTask.value?.status).toBe('cancelled')
    expect(model.canCancel.value).toBe(false)
  })

  it.each(['success', 'failure'])('does not attach late cancellation %s feedback to another selected task', async (outcome) => {
    const first = createTask({ id: 'first' })
    const second = createTask({ id: 'second' })
    dashboardInvestigations.value = { version: 1, items: [first, second] }
    const { model } = setupInvestigation()
    model.selectTask(first.id)
    const deferred = Promise.withResolvers<DashboardInvestigation>()
    vi.mocked(cancelDashboardInvestigation).mockReturnValue(deferred.promise)
    const pending = model.cancelTask()
    model.selectTask(second.id)
    if (outcome === 'success') {
      deferred.resolve({ ...first, status: 'cancelled', version: 2 })
    }
    else {
      deferred.reject(new Error('connection interrupted'))
    }
    await pending
    expect(model.selectedTask.value).toEqual(second)
    expect(model.notice.value).toBe('')
    expect(model.error.value).toBe('')
    expect(model.busy.value).toBe(false)
  })

  it('needs a newer report, nonempty summary and fresh human confirmation before verification', async () => {
    const task = createTask({ status: 'completed', version: 6 })
    dashboardInvestigations.value = { version: 6, items: [task] }
    const { model } = setupInvestigation()
    model.selectTask(task.id)
    model.verificationSummary.value = 'Checked behavior and output size'
    model.confirmVerification(true)
    expect(model.canVerify.value).toBe(false)
    const newer = { ...report, revision: 2, reportHash: 'b'.repeat(64) }
    dashboardReportIdentity.value = newer
    expect(model.canVerify.value).toBe(false)
    model.confirmVerification(true)
    expect(model.canVerify.value).toBe(true)
    dashboardReportIdentity.value = { ...newer, revision: 3, reportHash: 'c'.repeat(64) }
    expect(model.verification.value).toBeNull()
    expect(model.verificationSummary.value).toBe('Checked behavior and output size')
    await model.verifyTask()
    expect(verifyDashboardInvestigation).not.toHaveBeenCalled()
    model.confirmVerification(true)
    model.verificationSummary.value = '   '
    expect(model.canVerify.value).toBe(false)
    model.verificationSummary.value = 'Verified the newer build manually'
    vi.mocked(verifyDashboardInvestigation).mockRejectedValueOnce(new Error('CAS conflict'))
    await model.verifyTask()
    expect(verifyDashboardInvestigation).toHaveBeenCalledWith({ id: task.id, version: 6, report: dashboardReportIdentity.value, summary: 'Verified the newer build manually' })
    expect(model.verificationSummary.value).toBe('Verified the newer build manually')
    expect(model.selectedTask.value?.status).toBe('completed')
    dashboardConnectionStatus.value = 'disconnected'
    dashboardReportIdentity.value = null
    expect(model.verification.value).toBeNull()
    expect(model.verificationSummary.value).toBe('Verified the newer build manually')
  })

  it('ignores an accepted result after the local owner has been disposed', async () => {
    const { model, scope } = setupInvestigation()
    model.question.value = 'Keep local draft'
    const deferred = Promise.withResolvers<DashboardInvestigation>()
    vi.mocked(createDashboardInvestigation).mockReturnValue(deferred.promise)
    const pending = model.submitDraft()
    scope.stop()
    deferred.resolve(createTask())
    await pending
    expect(model.draft.value).not.toBeNull()
    expect(model.selectedId.value).toBeNull()
  })
})
