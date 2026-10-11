import type { AnalyzeSubpackagesResult } from '../../analyze/subpackages'
import type { DashboardAgentInvestigationRequest, DashboardInvestigation, DashboardInvestigationClaim, DashboardInvestigationRequest, DashboardInvestigationsState, DashboardInvestigationStatus, DashboardReportIdentity } from './types'
import { randomBytes, randomUUID } from 'node:crypto'
import {
  agentInvestigationRequestSchema,
  authorizeInvestigationRequestSchema,
  claimInvestigationRequestSchema,
  completeInvestigationRequestSchema,
  createInvestigationRequestSchema,
  getInvestigationRequestSchema,
  investigationRequestSchema,
  proposeInvestigationRequestSchema,
  verifyInvestigationRequestSchema,
} from './schema'
import { resolveInvestigationTarget } from './target'

interface InvestigationEntry {
  task: DashboardInvestigation
  claimToken?: string
}

export interface DashboardInvestigationStore {
  list: () => DashboardInvestigationsState
  get: (input: unknown) => DashboardInvestigation
  create: (input: unknown) => DashboardInvestigation
  cancel: (input: unknown) => DashboardInvestigation
  claim: (input: unknown) => DashboardInvestigationClaim
  propose: (input: unknown) => DashboardInvestigation
  authorize: (input: unknown) => DashboardInvestigation
  start: (input: unknown) => DashboardInvestigation
  complete: (input: unknown) => DashboardInvestigation
  verify: (input: unknown) => DashboardInvestigation
  reportUpdated: () => void
  dispose: () => void
}

const terminal: Partial<Record<DashboardInvestigationStatus, true>> = { completed: true, failed: true, cancelled: true, stale: true, verified: true }

/** 会话内唯一任务所有者；同步完成校验与 CAS 提交，再通知传输层。 */
export function createDashboardInvestigationStore(
  readReport: () => { identity: DashboardReportIdentity, result: AnalyzeSubpackagesResult },
  onChange: () => void,
): DashboardInvestigationStore {
  const entries = new Map<string, InvestigationEntry>()
  let version = 0

  function requireCurrent(identity: DashboardReportIdentity) {
    const current = readReport()
    if (identity.sessionId !== current.identity.sessionId || identity.revision !== current.identity.revision || identity.reportHash !== current.identity.reportHash) {
      throw new Error('Investigation report is stale; refresh the Dashboard report.')
    }
    return current.result
  }

  function getEntry(id: string) {
    readReport()
    const entry = entries.get(id)
    if (!entry) {
      throw new Error('Investigation does not exist in this Dashboard session.')
    }
    return entry
  }

  function requireVersion(input: DashboardInvestigationRequest, statuses: DashboardInvestigationStatus[]) {
    const entry = getEntry(input.id)
    if (entry.task.version !== input.version) {
      throw new Error('Investigation version conflict; refresh the task before retrying.')
    }
    if (!statuses.includes(entry.task.status)) {
      throw new Error(`Investigation cannot transition from ${entry.task.status}.`)
    }
    return entry
  }

  function requireAgent(input: DashboardAgentInvestigationRequest, statuses: DashboardInvestigationStatus[]) {
    const entry = requireVersion(input, statuses)
    if (!entry.claimToken || entry.claimToken !== input.claimToken) {
      throw new Error('Invalid investigation claim token.')
    }
    return entry
  }

  function commit(entry: InvestigationEntry, status: DashboardInvestigationStatus): DashboardInvestigation {
    entry.task.status = status
    entry.task.version += 1
    entry.task.updatedAt = new Date().toISOString()
    version += 1
    if (terminal[status]) {
      delete entry.claimToken
    }
    onChange()
    return structuredClone(entry.task)
  }

  return {
    list(): DashboardInvestigationsState {
      readReport()
      return { version, items: Array.from(entries.values(), entry => structuredClone(entry.task)) }
    },
    get(input: unknown): DashboardInvestigation {
      const { id } = getInvestigationRequestSchema.parse(input)
      return structuredClone(getEntry(id).task)
    },
    create(input: unknown): DashboardInvestigation {
      const request = createInvestigationRequestSchema.parse(input)
      const result = requireCurrent(request.report)
      const evidence = resolveInvestigationTarget(result, request.target)
      if (!evidence) {
        throw new Error('Investigation target is not present in the current report placement.')
      }
      if (entries.size === 32) {
        const oldestTerminal = Array.from(entries.values()).find(entry => terminal[entry.task.status])
        if (!oldestTerminal) {
          throw new Error('Dashboard already has 32 active investigations; cancel one before submitting another.')
        }
        entries.delete(oldestTerminal.task.id)
      }
      const now = new Date().toISOString()
      const task: DashboardInvestigation = {
        id: randomUUID(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        report: request.report,
        target: request.target,
        question: request.question,
        evidence,
        status: 'submitted',
        agent: null,
        proposal: null,
        authorization: null,
        receipt: null,
        verification: null,
      }
      entries.set(task.id, { task })
      version += 1
      onChange()
      return structuredClone(task)
    },
    cancel(input: unknown): DashboardInvestigation {
      const request = investigationRequestSchema.parse(input)
      const entry = requireVersion(request, ['submitted', 'claimed', 'proposed', 'authorized', 'executing'])
      // 只撤销协议内后续操作，不声称能够终止外部 Agent 的进程。
      entry.task.authorization = null
      return commit(entry, 'cancelled')
    },
    claim(input: unknown) {
      const request = claimInvestigationRequestSchema.parse(input)
      const entry = requireVersion(request, ['submitted'])
      requireCurrent(entry.task.report)
      const claimToken = randomBytes(32).toString('hex')
      entry.claimToken = claimToken
      entry.task.agent = { name: request.agentName, claimedAt: new Date().toISOString() }
      return { investigation: commit(entry, 'claimed'), claimToken }
    },
    propose(input: unknown): DashboardInvestigation {
      const request = proposeInvestigationRequestSchema.parse(input)
      const entry = requireAgent(request, ['claimed', 'proposed'])
      requireCurrent(entry.task.report)
      entry.task.proposal = { ...request.proposal, id: randomUUID() }
      return commit(entry, 'proposed')
    },
    authorize(input: unknown): DashboardInvestigation {
      const request = authorizeInvestigationRequestSchema.parse(input)
      const entry = requireVersion(request, ['proposed'])
      requireCurrent(entry.task.report)
      if (entry.task.proposal?.id !== request.proposalId) {
        throw new Error('Investigation proposal changed; review the exact current proposal.')
      }
      entry.task.authorization = { proposalId: request.proposalId, authorizedAt: new Date().toISOString() }
      return commit(entry, 'authorized')
    },
    start(input: unknown): DashboardInvestigation {
      const request = agentInvestigationRequestSchema.parse(input)
      const entry = requireAgent(request, ['authorized'])
      requireCurrent(entry.task.report)
      if (!entry.task.proposal || entry.task.authorization?.proposalId !== entry.task.proposal.id) {
        throw new Error('The exact investigation proposal has not been authorized.')
      }
      return commit(entry, 'executing')
    },
    complete(input: unknown): DashboardInvestigation {
      const request = completeInvestigationRequestSchema.parse(input)
      const entry = requireAgent(request, ['executing'])
      // 执行期间允许重建；回执仍绑定原任务，不把外部自报当作人工验证。
      entry.task.receipt = { ...request.receipt, reportedAt: new Date().toISOString() }
      return commit(entry, request.receipt.outcome)
    },
    verify(input: unknown): DashboardInvestigation {
      const request = verifyInvestigationRequestSchema.parse(input)
      const entry = requireVersion(request, ['completed'])
      const result = requireCurrent(request.report)
      if (request.report.revision <= entry.task.report.revision) {
        throw new Error('Human verification requires a newer report than the investigation baseline.')
      }
      entry.task.verification = {
        report: request.report,
        summary: request.summary,
        after: resolveInvestigationTarget(result, entry.task.target),
        verifiedAt: new Date().toISOString(),
      }
      return commit(entry, 'verified')
    },
    reportUpdated() {
      // 控制器在整份报告发布后统一广播，避免发出半更新状态。
      for (const entry of entries.values()) {
        if (['submitted', 'claimed', 'proposed', 'authorized'].includes(entry.task.status)) {
          entry.task.status = 'stale'
          entry.task.version += 1
          entry.task.updatedAt = new Date().toISOString()
          entry.task.authorization = null
          delete entry.claimToken
          version += 1
        }
      }
    },
    dispose() {
      entries.clear()
      version = 0
    },
  }
}
