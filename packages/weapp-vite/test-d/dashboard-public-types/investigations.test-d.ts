import type { DevframeRpcClientFunctions, DevframeRpcServerFunctions } from 'devframe'
import type {
  DashboardAgentInvestigationRequest,
  DashboardAnalyzePage,
  DashboardAnalyzePageRequest,
  DashboardAnalyzePayloadDescriptor,
  DashboardAnalyzePayloadsDescriptor,
  DashboardAuthorizeInvestigationRequest,
  DashboardClaimInvestigationRequest,
  DashboardCompleteInvestigationRequest,
  DashboardCreateInvestigationRequest,
  DashboardDevframeState,
  DashboardInvestigation,
  DashboardInvestigationClaim,
  DashboardInvestigationProposal,
  DashboardInvestigationProposalInput,
  DashboardInvestigationReceiptInput,
  DashboardInvestigationRequest,
  DashboardInvestigationsState,
  DashboardInvestigationStatus,
  DashboardInvestigationTarget,
  DashboardObjectMeasurements,
  DashboardProposeInvestigationRequest,
  DashboardReportIdentity,
  DashboardVerifyInvestigationRequest,
} from 'weapp-vite/dashboard'
import { expectError, expectType } from 'tsd'
import * as dashboard from 'weapp-vite/dashboard'

declare const rpc: DevframeRpcServerFunctions
declare const client: DevframeRpcClientFunctions
declare const state: DashboardDevframeState
declare const task: DashboardInvestigation
declare const target: DashboardInvestigationTarget
declare const report: DashboardReportIdentity
declare const proposal: DashboardInvestigationProposalInput
declare const receipt: DashboardInvestigationReceiptInput

expectType<DashboardDevframeState>(rpc['weapp-vite:get-dashboard-state']())
expectType<string>(state.sessionId)
expectType<DashboardAnalyzePayloadsDescriptor>(state.analyze)
expectType<DashboardAnalyzePayloadDescriptor>(state.analyze.current)
expectType<DashboardInvestigationsState>(state.investigations)
expectType<void>(client['weapp-vite:dashboard-state-updated'](state))
const pageRequest: DashboardAnalyzePageRequest = { revision: state.revision, target: 'current', index: 0 }
expectType<DashboardAnalyzePage>(rpc['weapp-vite:get-analyze-page'](pageRequest))

const create: DashboardCreateInvestigationRequest = { report, target, question: 'Explain this object' }
const request: DashboardInvestigationRequest = { id: task.id, version: task.version }
const claim: DashboardClaimInvestigationRequest = { ...request, agentName: 'External Agent' }
const claimed = rpc['weapp-vite:claim-investigation'](claim)
expectType<DashboardInvestigationClaim>(claimed)
expectType<string>(claimed.claimToken)
expectType<DashboardInvestigation>(claimed.investigation)
const agent: DashboardAgentInvestigationRequest = { ...request, claimToken: claimed.claimToken }
const propose: DashboardProposeInvestigationRequest = { ...agent, proposal }
const authorize: DashboardAuthorizeInvestigationRequest = { ...request, proposalId: 'proposal-id' }
const complete: DashboardCompleteInvestigationRequest = { ...agent, receipt }
const verify: DashboardVerifyInvestigationRequest = { ...request, report, summary: 'Human reviewed a newer report' }

expectType<DashboardInvestigationsState>(rpc['weapp-vite:list-investigations']())
expectType<DashboardInvestigation>(rpc['weapp-vite:get-investigation']({ id: task.id }))
expectType<DashboardInvestigation>(rpc['weapp-vite:create-investigation'](create))
expectType<DashboardInvestigation>(rpc['weapp-vite:cancel-investigation'](request))
expectType<DashboardInvestigation>(rpc['weapp-vite:propose-investigation'](propose))
expectType<DashboardInvestigation>(rpc['weapp-vite:authorize-investigation'](authorize))
expectType<DashboardInvestigation>(rpc['weapp-vite:start-investigation'](agent))
expectType<DashboardInvestigation>(rpc['weapp-vite:complete-investigation'](complete))
expectType<DashboardInvestigation>(rpc['weapp-vite:verify-investigation'](verify))
expectType<DashboardInvestigationStatus>(task.status)
expectType<DashboardObjectMeasurements>(task.evidence)
expectType<DashboardInvestigationProposal | null>(task.proposal)
expectType<DashboardReportIdentity>(task.report)
expectType<DashboardInvestigationTarget>(task.target)
expectType<number | null>(task.evidence.attributedBytes)
expectType<number | null>(task.evidence.sourceBytes)
expectType<DashboardObjectMeasurements | null | undefined>(task.verification?.after)
expectType<'completed' | 'failed' | undefined>(task.receipt?.outcome)

expectError(task.claimToken)
expectError(state.investigations.items[0]!.claimToken)
expectError(rpc['weapp-vite:create-investigation']({ target, question: 'No report identity' }))
expectError(rpc['weapp-vite:create-investigation']({ report: { revision: 1, reportHash: 'hash' }, target, question: 'No session' }))
expectError(rpc['weapp-vite:create-investigation']({ report, target: { kind: 'module', packageId: 'main', moduleId: 'module' }, question: 'No placement' }))
expectError(rpc['weapp-vite:cancel-investigation']({ id: task.id }))
expectError(rpc['weapp-vite:claim-investigation'](request))
expectError(rpc['weapp-vite:propose-investigation']({ ...request, proposal }))
expectError(rpc['weapp-vite:authorize-investigation'](request))
expectError(rpc['weapp-vite:start-investigation'](request))
expectError(rpc['weapp-vite:complete-investigation']({ ...agent, receipt: { ...receipt, outcome: 'verified' } }))
expectError(rpc['weapp-vite:verify-investigation']({ ...request, report }))
expectError(dashboard.createDashboardInvestigationStore)
expectError(dashboard.createDashboardInvestigationRpc)
expectError(dashboard.resolveInvestigationTarget)
