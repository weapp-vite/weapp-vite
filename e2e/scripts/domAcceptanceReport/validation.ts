import type { DomAcceptance } from '../../utils/domAcceptance/types'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { assertResponsiveStyle } from '../../utils/domAcceptance/styles'
import { runtimeDiagnosticSchema } from './runtimeDiagnostics'

const strings = z.record(z.string(), z.string())
const query = z.enum(['css', 'xpath'])
const has = z.string().min(1).optional()
const scope = z.array(z.union([z.string().min(1), z.object({ has: z.string().min(1) })])).optional()
const expectation = z.object({
  selector: z.string().min(1),
  query: query.optional(),
  has,
  scope,
  count: z.number().int().nonnegative().optional(),
  text: z.string().optional(),
  attributes: strings.optional(),
  styles: z.record(z.string(), z.union([z.string(), z.object({ rpx: z.number().finite() })])).optional(),
  visible: z.boolean().optional(),
})
const node = z.object({
  text: z.string().optional(),
  attributes: strings.optional(),
  styles: strings.optional(),
  size: z.object({ width: z.number().finite().nonnegative(), height: z.number().finite().nonnegative() }).optional(),
})
export const serializedPlan = z.object({
  fixture: z.string().min(1),
  provider: z.enum(['devtools', 'headless']),
  errorScopes: z.array(z.object({ checkpoint: z.string().min(1), id: z.string().min(1) })).optional(),
  checkpoints: z.array(z.object({
    id: z.string().min(1),
    route: z.string().min(1),
    action: z.string().min(1),
    nodes: z.array(expectation).min(1),
    expectedErrors: z.array(z.object({ source: z.enum(['build', 'runtime']), level: z.enum(['error', 'exception']), channel: z.string().min(1), text: z.string().min(1), count: z.number().int().positive() })).optional(),
  })).min(1),
  evidence: z.array(z.object({
    id: z.string().min(1),
    route: z.string().min(1),
    source: z.enum(['devtools-page-frame', 'headless-logical-tree']),
    capturedAt: z.iso.datetime(),
    windowWidth: z.number().finite().positive().optional(),
    nodes: z.array(z.object({ selector: z.string().min(1), query, has, scope, count: z.number().int().nonnegative(), nodes: z.array(node) })),
  })),
}).passthrough()

function equal(actual: unknown, expected: unknown, label: string) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`Serialized DOM evidence mismatch: ${label}`)
  }
}

export function assertSerializedDomEvidence(plan: DomAcceptance) {
  serializedPlan.parse(plan)
  for (const [index, checkpoint] of plan.checkpoints.entries()) {
    const evidence = plan.evidence[index]!
    equal(evidence.nodes.length, checkpoint.nodes.length, `${checkpoint.id} selector coverage`)
    for (const [nodeIndex, expected] of checkpoint.nodes.entries()) {
      const actual = evidence.nodes[nodeIndex]!
      equal(actual.selector, expected.selector, `${checkpoint.id} selector`)
      equal(actual.query, expected.query ?? 'css', `${checkpoint.id} query`)
      equal(actual.has, expected.has, `${checkpoint.id} has`)
      equal(actual.scope ?? [], expected.scope ?? [], `${checkpoint.id} scope`)
      equal(actual.count, expected.count ?? 1, `${checkpoint.id} count`)
      equal(actual.nodes.length, actual.count, `${checkpoint.id} captured nodes`)
      for (const captured of actual.nodes) {
        if (expected.text !== undefined) {
          equal(captured.text, expected.text, `${checkpoint.id} text`)
        }
        for (const [key, value] of Object.entries(expected.attributes ?? {})) {
          equal(captured.attributes?.[key], value, `${checkpoint.id} attribute ${key}`)
        }
        for (const [key, value] of Object.entries(expected.styles ?? {})) {
          if (typeof value === 'string') {
            equal(captured.styles?.[key], value, `${checkpoint.id} style ${key}`)
          }
          else {
            equal(plan.provider, 'devtools', `${checkpoint.id} responsive style provider`)
            assertResponsiveStyle(captured.styles?.[key], value.rpx, evidence.windowWidth, `${checkpoint.id} style ${key}`)
          }
        }
        if (expected.visible !== undefined) {
          if (!captured.size || !captured.styles || ['display', 'visibility', 'opacity'].some(key => typeof captured.styles?.[key] !== 'string')) {
            throw new Error(`Serialized DOM evidence missing layout: ${checkpoint.id}`)
          }
          const { display, visibility, opacity } = captured.styles
          if (!display || !visibility || !opacity || !Number.isFinite(Number(opacity)) || Number(opacity) < 0 || Number(opacity) > 1) {
            throw new Error(`Serialized DOM evidence invalid computed visibility: ${checkpoint.id}`)
          }
          equal(captured.size.width > 0 && captured.size.height > 0 && display !== 'none'
            && visibility !== 'hidden' && visibility !== 'collapse' && Number(opacity) > 0, expected.visible, `${checkpoint.id} visibility`)
        }
      }
    }
  }
}

const summary = z.object({
  plannedCount: z.number().int().nonnegative(),
  executedCount: z.number().int().nonnegative(),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  notExecutedCount: z.number().int().nonnegative(),
  plannedCheckpointCount: z.number().int().nonnegative(),
  capturedCheckpointCount: z.number().int().nonnegative(),
})

export const serializedReport = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  commitSha: z.string().min(1),
  invocationId: z.string().min(1),
  taskLabel: z.string().min(1),
  template: z.string().nullable(),
  provider: z.enum(['devtools', 'headless']),
  strict: z.boolean(),
  environment: z.object({ nodeVersion: z.string(), ideVersion: z.string().nullable(), baseLibraryVersion: z.string().nullable() }),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  status: z.enum(['passed', 'failed', 'blocked', 'skipped', 'not-executed']),
  errors: z.array(z.string()),
  runtimeDiagnostics: z.array(runtimeDiagnosticSchema).optional(),
  summary,
  cases: z.array(z.object({
    id: z.string().min(1),
    file: z.string().min(1),
    name: z.string().min(1),
    state: z.enum(['passed', 'failed', 'skipped', 'pending']),
    status: z.enum(['passed', 'failed', 'blocked', 'skipped', 'not-executed']),
    violations: z.array(z.string()),
    startedAt: z.number().finite(),
    finishedAt: z.number().finite(),
    acceptance: serializedPlan,
  }).passthrough()).min(1),
}).passthrough()
