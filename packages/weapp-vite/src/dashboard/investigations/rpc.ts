import type { DashboardInvestigationStore } from './store'
import { defineRpcFunction } from 'devframe'
import {
  agentInvestigationRequestSchema,
  authorizeInvestigationRequestSchema,
  claimInvestigationRequestSchema,
  completeInvestigationRequestSchema,
  createInvestigationRequestSchema,
  getInvestigationRequestSchema,
  investigationClaimSchema,
  investigationRequestSchema,
  investigationSchema,
  investigationsStateSchema,
  proposeInvestigationRequestSchema,
  verifyInvestigationRequestSchema,
} from './schema'

/** 浏览器所有者操作刻意不声明 agent，由 DevFrame 的默认拒绝边界隔离。 */
export function createDashboardInvestigationRpc(store: DashboardInvestigationStore) {
  return [
    defineRpcFunction({
      name: 'list-investigations',
      type: 'query',
      jsonSerializable: true,
      args: [],
      returns: investigationsStateSchema,
      agent: {
        title: 'List object investigations',
        safety: 'read',
        description: 'Read up to 32 session-local investigation records. Tasks pin session, revision, report hash and exact report placement. Agent names and receipts are self-reported, not authentication or independent verification.',
      },
      handler: store.list,
    }),
    defineRpcFunction({
      name: 'get-investigation',
      type: 'query',
      jsonSerializable: true,
      args: [getInvestigationRequestSchema],
      returns: investigationSchema,
      agent: {
        title: 'Read object investigation',
        safety: 'read',
        description: 'Read a task, its current CAS version, exact proposal and browser authorization. Private claim tokens are never present in task state. Re-read after a version conflict; do not replay actions.',
      },
      handler: store.get,
    }),
    defineRpcFunction({
      name: 'create-investigation',
      type: 'action',
      jsonSerializable: true,
      args: [createInvestigationRequestSchema],
      returns: investigationSchema,
      handler: store.create,
    }),
    defineRpcFunction({
      name: 'cancel-investigation',
      type: 'action',
      jsonSerializable: true,
      args: [investigationRequestSchema],
      returns: investigationSchema,
      handler: store.cancel,
    }),
    defineRpcFunction({
      name: 'authorize-investigation',
      type: 'action',
      jsonSerializable: true,
      args: [authorizeInvestigationRequestSchema],
      returns: investigationSchema,
      handler: store.authorize,
    }),
    defineRpcFunction({
      name: 'verify-investigation',
      type: 'action',
      jsonSerializable: true,
      args: [verifyInvestigationRequestSchema],
      returns: investigationSchema,
      handler: store.verify,
    }),
    defineRpcFunction({
      name: 'claim-investigation',
      type: 'action',
      jsonSerializable: true,
      args: [claimInvestigationRequestSchema],
      returns: investigationClaimSchema,
      agent: {
        title: 'Claim object investigation',
        safety: 'action',
        description: 'Claim a submitted task using its current id/version and a self-reported agentName. Only the winning claim returns a private claimToken; keep it private. This changes task metadata only, not source files or execution permissions.',
      },
      handler: store.claim,
    }),
    defineRpcFunction({
      name: 'propose-investigation',
      type: 'action',
      jsonSerializable: true,
      args: [proposeInvestigationRequestSchema],
      returns: investigationSchema,
      agent: {
        title: 'Propose investigation changes',
        safety: 'action',
        description: 'Submit exact proposed paths, descriptions, checks and risks using id/version/claimToken. Proposals may be replaced before browser authorization only. Report hashes identify reports, not current source contents; obtain external OS/workspace permission separately.',
      },
      handler: store.propose,
    }),
    defineRpcFunction({
      name: 'start-investigation',
      type: 'action',
      jsonSerializable: true,
      args: [agentInvestigationRequestSchema],
      returns: investigationSchema,
      agent: {
        title: 'Start authorized investigation',
        safety: 'action',
        description: 'Consume the current exact browser-authorized proposal once with id/version/claimToken. Rejects stale reports and replay. Only records execution intent: no commands or filesystem writes run here; actual work and OS permissions remain external.',
      },
      handler: store.start,
    }),
    defineRpcFunction({
      name: 'complete-investigation',
      type: 'action',
      jsonSerializable: true,
      args: [completeInvestigationRequestSchema],
      returns: investigationSchema,
      agent: {
        title: 'Report external investigation result',
        safety: 'action',
        description: 'Report external completion or failure with changedFiles and actual check outcomes using id/version/claimToken. Rebuilds during execution are allowed; cancelled tasks reject receipts. A receipt is self-reported and never marks human verification complete.',
      },
      handler: store.complete,
    }),
  ]
}
