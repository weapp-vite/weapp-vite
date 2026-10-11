import type {
  DashboardAgentInvestigationRequest,
  DashboardAuthorizeInvestigationRequest,
  DashboardClaimInvestigationRequest,
  DashboardCompleteInvestigationRequest,
  DashboardCreateInvestigationRequest,
  DashboardInvestigation,
  DashboardInvestigationClaim,
  DashboardInvestigationProposalInput,
  DashboardInvestigationReceiptInput,
  DashboardInvestigationRequest,
  DashboardInvestigationsState,
  DashboardInvestigationTarget,
  DashboardObjectMeasurements,
  DashboardProposeInvestigationRequest,
  DashboardReportIdentity,
  DashboardVerifyInvestigationRequest,
} from './types'
import { z } from 'zod'

const id = z.string().uuid()
const version = z.number().int().positive()
const text = z.string().trim().min(1).max(4096)
const path = z.string().min(1).max(2048)
const bytes = z.number().nonnegative().nullable()

export const reportIdentitySchema = z.strictObject({
  sessionId: id,
  revision: z.number().int().nonnegative(),
  reportHash: z.string().regex(/^[a-f0-9]{64}$/),
}) satisfies z.ZodType<DashboardReportIdentity>

export const investigationTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('package'), packageId: path }),
  z.strictObject({ kind: z.literal('artifact'), packageId: path, file: path }),
  z.strictObject({ kind: z.literal('module'), packageId: path, file: path, moduleId: path }),
]) satisfies z.ZodType<DashboardInvestigationTarget>

const measurementsSchema = z.strictObject({
  label: z.string(),
  rawBytes: bytes,
  gzipBytes: bytes,
  brotliBytes: bytes,
  attributedBytes: bytes,
  sourceBytes: bytes,
}) satisfies z.ZodType<DashboardObjectMeasurements>

export const investigationProposalInputSchema = z.strictObject({
  summary: text,
  changes: z.array(z.strictObject({ path, description: text })).min(1).max(64),
  checks: z.array(text).min(1).max(32),
  risks: z.array(text).max(32),
}) satisfies z.ZodType<DashboardInvestigationProposalInput>

export const investigationReceiptInputSchema = z.strictObject({
  outcome: z.enum(['completed', 'failed']),
  summary: text,
  changedFiles: z.array(path).max(64),
  checks: z.array(z.strictObject({
    command: text,
    outcome: z.enum(['passed', 'failed', 'not-run']),
    summary: text,
  })).max(32),
}) satisfies z.ZodType<DashboardInvestigationReceiptInput>

export const investigationSchema = z.strictObject({
  id,
  version,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  report: reportIdentitySchema,
  target: investigationTargetSchema,
  question: text,
  evidence: measurementsSchema,
  status: z.enum(['submitted', 'claimed', 'proposed', 'authorized', 'executing', 'completed', 'failed', 'cancelled', 'stale', 'verified']),
  agent: z.strictObject({ name: z.string().trim().min(1).max(120), claimedAt: z.string().datetime() }).nullable(),
  proposal: investigationProposalInputSchema.extend({ id }).nullable(),
  authorization: z.strictObject({ proposalId: id, authorizedAt: z.string().datetime() }).nullable(),
  receipt: investigationReceiptInputSchema.extend({ reportedAt: z.string().datetime() }).nullable(),
  verification: z.strictObject({
    report: reportIdentitySchema,
    summary: text,
    after: measurementsSchema.nullable(),
    verifiedAt: z.string().datetime(),
  }).nullable(),
}) satisfies z.ZodType<DashboardInvestigation>

export const investigationsStateSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  items: z.array(investigationSchema).max(32),
}) satisfies z.ZodType<DashboardInvestigationsState>

export const getInvestigationRequestSchema = z.strictObject({ id })

export const createInvestigationRequestSchema = z.strictObject({
  report: reportIdentitySchema,
  target: investigationTargetSchema,
  question: text,
}) satisfies z.ZodType<DashboardCreateInvestigationRequest>

export const investigationRequestSchema = z.strictObject({ id, version }) satisfies z.ZodType<DashboardInvestigationRequest>

export const claimInvestigationRequestSchema = investigationRequestSchema.extend({
  agentName: z.string().trim().min(1).max(120),
}) satisfies z.ZodType<DashboardClaimInvestigationRequest>

export const investigationClaimSchema = z.strictObject({
  investigation: investigationSchema,
  claimToken: z.string().regex(/^[a-f0-9]{64}$/),
}) satisfies z.ZodType<DashboardInvestigationClaim>

export const agentInvestigationRequestSchema = investigationRequestSchema.extend({
  claimToken: z.string().regex(/^[a-f0-9]{64}$/),
}) satisfies z.ZodType<DashboardAgentInvestigationRequest>

export const proposeInvestigationRequestSchema = agentInvestigationRequestSchema.extend({
  proposal: investigationProposalInputSchema,
}) satisfies z.ZodType<DashboardProposeInvestigationRequest>

export const authorizeInvestigationRequestSchema = investigationRequestSchema.extend({
  proposalId: id,
}) satisfies z.ZodType<DashboardAuthorizeInvestigationRequest>

export const completeInvestigationRequestSchema = agentInvestigationRequestSchema.extend({
  receipt: investigationReceiptInputSchema,
}) satisfies z.ZodType<DashboardCompleteInvestigationRequest>

export const verifyInvestigationRequestSchema = investigationRequestSchema.extend({
  report: reportIdentitySchema,
  summary: text,
}) satisfies z.ZodType<DashboardVerifyInvestigationRequest>
