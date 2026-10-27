import { z } from 'zod'
import { assertVerificationTopology } from '../../../scripts/verification/topology.ts'
import { verificationProfileSchema } from './profile'
import { SUITE_TASK_ARTIFACT_KINDS, VERIFICATION_TOOL_VERSION } from './types'

const topologySchema = z.object({
  id: z.enum(['legacy-v1', 'optimized-v1', 'optimized-v2']),
  policy: z.literal('verification-topology-v1'),
  policyDigest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().refine((value) => {
  try {
    assertVerificationTopology(value)
    return true
  }
  catch {
    return false
  }
}, 'Verification topology policy mismatch')

const providerCaseScopeSchema = z.object({
  providers: z.array(z.enum(['devtools', 'headless'])).min(1),
  conditions: z.array(z.object({ modifier: z.enum(['runIf', 'skipIf']), expression: z.string().min(1), source: z.string().min(1) }).strict()).min(1),
  provider: z.enum(['devtools', 'headless']),
  scope: z.enum(['in-scope', 'out-of-scope']),
  reason: z.string().min(1),
}).strict()

const plannedCaseSchema = z.object({ file: z.string().min(1), name: z.string().min(1), providerScope: providerCaseScopeSchema.optional() }).strict()

export const verificationPlanSchema = z.object({
  schemaVersion: z.literal(1),
  toolVersion: z.number().int().positive(),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  runId: z.string().min(1),
  commitSha: z.string().regex(/^[a-f0-9]{40,64}$/),
  workingTreeDirty: z.boolean().nullable(),
  createdAt: z.iso.datetime(),
  suite: z.string().min(1),
  strict: z.boolean(),
  profile: verificationProfileSchema,
  executionTopology: topologySchema,
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  shardTotal: z.number().int().positive(),
  historySources: z.array(z.string()),
  tasks: z.array(z.object({
    label: z.string().min(1),
    definitionHash: z.string().regex(/^[a-f0-9]{64}$/),
    estimatedDurationMs: z.number().finite().positive(),
    shardIndex: z.number().int().nonnegative(),
    outOfScopeReason: z.string().min(1).optional(),
    cases: z.array(plannedCaseSchema).optional(),
    acceptanceTemplates: z.array(z.string().min(1)).optional(),
  }).strict()).min(1),
}).strict()

export const durationHistorySchema = z.object({
  schemaVersion: z.literal(1),
  toolVersion: z.number().int().positive(),
  profile: verificationProfileSchema,
  generatedAt: z.iso.datetime(),
  tasks: z.record(z.string(), z.object({ durationMs: z.number().finite().positive(), samples: z.number().int().positive(), sources: z.array(z.string()).min(1) }).strict()),
}).strict()

export const historyReceiptSchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  workflow: z.string().min(1),
  runId: z.number().int().positive(),
  runAttempt: z.number().int().positive(),
  headSha: z.string().regex(/^[a-f0-9]{40,64}$/),
  headBranch: z.string().min(1),
  defaultBranch: z.string().min(1),
  event: z.enum(['push', 'schedule', 'workflow_dispatch']),
  conclusion: z.literal('success'),
  verified: z.literal(true),
}).strict()

export const verificationExecutionSchema = z.object({
  executionTopology: topologySchema.optional(),
  scope: z.enum(['full', 'shard', 'ad-hoc']),
  status: z.enum(['passed', 'failed', 'cancelled', 'incomplete']),
  profile: verificationProfileSchema,
  planHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  shardIndex: z.number().int().positive().optional(),
  shardTotal: z.number().int().positive().optional(),
  assignedTasks: z.array(z.string().min(1)),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
}).strict()

export const verificationSuiteReportSchema = z.object({
  schemaVersion: z.literal(2),
  toolVersion: z.literal(VERIFICATION_TOOL_VERSION),
  runId: z.string().min(1),
  commitSha: z.string().min(1),
  workingTreeDirty: z.boolean().nullable(),
  strict: z.boolean(),
  coverage: z.enum(['complete', 'partial']),
  acceptance: z.enum(['passed', 'incomplete', 'failed']),
  execution: verificationExecutionSchema,
  summary: z.object({
    taskCount: z.number().int().nonnegative(),
    plannedCount: z.number().int().nonnegative(),
    executedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    passedCount: z.number().int().nonnegative(),
    blockedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    notExecutedCount: z.number().int().nonnegative(),
    outOfScopeCount: z.number().int().nonnegative(),
    artifactCount: z.number().int().nonnegative(),
    providerOutOfScopeCaseCount: z.number().int().nonnegative().optional(),
  }).strict(),
  tasks: z.array(z.object({
    label: z.string().min(1),
    definitionHash: z.string().optional(),
    durationMs: z.number().finite().nonnegative(),
    exitCode: z.number().int(),
    status: z.enum(['passed', 'failed', 'blocked', 'skipped', 'not-executed', 'out-of-scope']),
    artifacts: z.array(z.object({ kind: z.enum(SUITE_TASK_ARTIFACT_KINDS), indexPath: z.string().min(1) })),
    providerOutOfScopeCases: z.array(plannedCaseSchema).optional(),
  }).passthrough()),
}).passthrough().superRefine((report, context) => {
  const count = (status: string) => report.tasks.filter(task => task.status === status).length
  const expected = {
    taskCount: report.tasks.length,
    plannedCount: report.tasks.length - count('out-of-scope'),
    executedCount: report.tasks.length - count('out-of-scope') - count('not-executed'),
    failedCount: count('failed'),
    passedCount: count('passed'),
    blockedCount: count('blocked'),
    skippedCount: count('skipped'),
    notExecutedCount: count('not-executed'),
    outOfScopeCount: count('out-of-scope'),
    artifactCount: report.tasks.reduce((sum, task) => sum + task.artifacts.length, 0),
  }
  if (Object.entries(expected).some(([key, count]) => report.summary[key as keyof typeof expected] !== count)) {
    context.addIssue({ code: 'custom', message: 'Suite report summary does not match task evidence', path: ['summary'] })
  }
  if (report.summary.providerOutOfScopeCaseCount !== undefined
    && report.summary.providerOutOfScopeCaseCount !== report.tasks.reduce((sum, task) => sum + (task.providerOutOfScopeCases?.length ?? 0), 0)) {
    context.addIssue({ code: 'custom', message: 'Provider out-of-scope count does not match case scope records', path: ['summary'] })
  }
})
