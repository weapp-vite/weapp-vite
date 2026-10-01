import type { DashboardFileContent } from './content'
import type { DashboardRuntimeEvent, DashboardRuntimeEventProfile } from './events'
import type { DashboardAnalyzePage, DashboardAnalyzePageRequest, DashboardAnalyzePayloadDescriptor } from './payload'
import { z } from 'zod'

const nonnegativeInteger = z.number().int().nonnegative()
const revisionSchema = nonnegativeInteger.describe('Revision from get-dashboard-state; refresh state if it becomes stale.')
const analyzeTargetSchema = z.enum(['current', 'previous'])

const analyzeDescriptorSchema = z.object({
  characters: nonnegativeInteger,
  hash: z.string(),
  pages: z.number().int().positive(),
}) satisfies z.ZodType<DashboardAnalyzePayloadDescriptor>

export const dashboardAnalyzePageRequestSchema = z.object({
  index: nonnegativeInteger.describe('Zero-based page index, less than the selected descriptor pages count.'),
  revision: revisionSchema,
  target: analyzeTargetSchema,
}) satisfies z.ZodType<DashboardAnalyzePageRequest>

export const dashboardAnalyzePageSchema = z.object({
  content: z.string(),
  descriptor: analyzeDescriptorSchema,
  index: nonnegativeInteger,
  revision: revisionSchema,
  target: analyzeTargetSchema,
}) satisfies z.ZodType<DashboardAnalyzePage>

export const dashboardFileRequestSchema = z.object({
  kind: z.enum(['source', 'artifact']),
  path: z.string().describe('Report-listed relative path; source uses configured roots and artifact uses captured build content.'),
})

export const dashboardFileReadRequestSchema = dashboardFileRequestSchema.extend({
  revision: revisionSchema,
})

export const dashboardFileContentSchema = dashboardFileRequestSchema.extend({
  content: z.string(),
  language: z.string(),
  size: nonnegativeInteger,
}) satisfies z.ZodType<DashboardFileContent>

const runtimeEventProfileSchema = z.object({
  timestamp: z.string().optional(),
  totalMs: z.number().optional(),
  eventId: z.string().optional(),
  event: z.string().optional(),
  file: z.string().optional(),
  relativeFile: z.string().optional(),
  sourceRootFile: z.string().optional(),
  buildCoreMs: z.number().optional(),
  buildStartMs: z.number().optional(),
  pluginResolveMs: z.number().optional(),
  transformMs: z.number().optional(),
  snapshotResolveMs: z.number().optional(),
  snapshotBuildMs: z.number().optional(),
  writeMs: z.number().optional(),
  watchToDirtyMs: z.number().optional(),
  emitMs: z.number().optional(),
  sharedChunkResolveMs: z.number().optional(),
  resolveCount: z.number().optional(),
  dirtyCount: z.number().optional(),
  pendingCount: z.number().optional(),
  emittedCount: z.number().optional(),
  dirtyReasonSummary: z.array(z.string()).optional(),
  pendingReasonSummary: z.array(z.string()).optional(),
}) satisfies z.ZodType<DashboardRuntimeEventProfile>

const runtimeEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  source: z.string(),
  kind: z.enum(['command', 'build', 'diagnostic', 'hmr', 'system']),
  level: z.enum(['info', 'success', 'warning', 'error']),
  title: z.string(),
  detail: z.string(),
  durationMs: z.number().optional(),
  tags: z.array(z.string()).optional(),
  profile: runtimeEventProfileSchema.optional(),
}) satisfies z.ZodType<DashboardRuntimeEvent>

export const dashboardStateSchema = z.object({
  analyze: z.object({
    current: analyzeDescriptorSchema,
    previous: analyzeDescriptorSchema.nullable(),
  }),
  revision: revisionSchema,
  runtimeEvents: z.array(runtimeEventSchema),
})
