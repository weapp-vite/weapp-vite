export type DashboardInvestigationTarget
  = | { kind: 'package', packageId: string }
    | { kind: 'artifact', packageId: string, file: string }
    | { kind: 'module', packageId: string, file: string, moduleId: string }

export interface DashboardReportIdentity {
  sessionId: string
  revision: number
  reportHash: string
}

export interface DashboardObjectMeasurements {
  label: string
  rawBytes: number | null
  gzipBytes: number | null
  brotliBytes: number | null
  attributedBytes: number | null
  sourceBytes: number | null
}

export type DashboardInvestigationStatus
  = 'submitted' | 'claimed' | 'proposed' | 'authorized' | 'executing'
    | 'completed' | 'failed' | 'cancelled' | 'stale' | 'verified'

export interface DashboardInvestigationProposalInput {
  summary: string
  changes: Array<{ path: string, description: string }>
  checks: string[]
  risks: string[]
}

export interface DashboardInvestigationProposal extends DashboardInvestigationProposalInput {
  id: string
}

export interface DashboardInvestigationReceiptInput {
  outcome: 'completed' | 'failed'
  summary: string
  changedFiles: string[]
  checks: Array<{
    command: string
    outcome: 'passed' | 'failed' | 'not-run'
    summary: string
  }>
}

export interface DashboardInvestigation {
  id: string
  version: number
  createdAt: string
  updatedAt: string
  report: DashboardReportIdentity
  target: DashboardInvestigationTarget
  question: string
  evidence: DashboardObjectMeasurements
  status: DashboardInvestigationStatus
  agent: { name: string, claimedAt: string } | null
  proposal: DashboardInvestigationProposal | null
  authorization: { proposalId: string, authorizedAt: string } | null
  receipt: (DashboardInvestigationReceiptInput & { reportedAt: string }) | null
  verification: {
    report: DashboardReportIdentity
    summary: string
    after: DashboardObjectMeasurements | null
    verifiedAt: string
  } | null
}

export interface DashboardInvestigationsState {
  version: number
  items: DashboardInvestigation[]
}

export interface DashboardCreateInvestigationRequest {
  report: DashboardReportIdentity
  target: DashboardInvestigationTarget
  question: string
}

export interface DashboardInvestigationRequest {
  id: string
  version: number
}

export interface DashboardClaimInvestigationRequest extends DashboardInvestigationRequest {
  agentName: string
}

export interface DashboardInvestigationClaim {
  investigation: DashboardInvestigation
  claimToken: string
}

export interface DashboardAgentInvestigationRequest extends DashboardInvestigationRequest {
  claimToken: string
}

export interface DashboardProposeInvestigationRequest extends DashboardAgentInvestigationRequest {
  proposal: DashboardInvestigationProposalInput
}

export interface DashboardAuthorizeInvestigationRequest extends DashboardInvestigationRequest {
  proposalId: string
}

export interface DashboardCompleteInvestigationRequest extends DashboardAgentInvestigationRequest {
  receipt: DashboardInvestigationReceiptInput
}

export interface DashboardVerifyInvestigationRequest extends DashboardInvestigationRequest {
  report: DashboardReportIdentity
  summary: string
}
