import { z } from 'zod'

const count = z.number().int().nonnegative()
const packageType = z.enum(['main', 'subPackage', 'independent', 'virtual'])
const sourceType = z.enum(['src', 'plugin', 'node_modules', 'workspace'])
const change = z.enum(['added', 'removed', 'increased', 'decreased', 'unmeasured'])
const query = z.string().trim().max(200).optional()
const revision = count.describe('Revision from get-dashboard-state; refresh state when stale.')
const target = z.enum(['current', 'previous'])
const pagination = {
  offset: count.default(0),
  limit: z.number().int().min(1).max(100).default(20),
}
const pageResult = {
  total: count,
  offset: count,
  nextOffset: count.nullable(),
}
const reportResult = { revision, target, reportHash: z.string() }
const order = z.enum(['asc', 'desc']).default('desc')

export const analyzeQuerySchema = z.object({ revision, target: target.default('current') })

export const budgetCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  scope: z.enum(['total', 'runtime', 'main', 'subPackage', 'independent', 'virtual']),
  currentBytes: count,
  limitBytes: count,
  ratio: z.number(),
  status: z.enum(['ok', 'warning', 'exceeded', 'unknown']),
  measurement: z.enum(['file-bytes', 'upper-bound', 'unavailable']),
})

export const analyzeSummarySchema = z.object({
  ...reportResult,
  previousAvailable: z.boolean(),
  totals: z.object({ packages: count, files: count, modules: count, bytes: count, unmeasuredFiles: count }),
  totalBudget: budgetCheckSchema.nullable(),
  runtimeBudget: budgetCheckSchema.nullable(),
  packageBudgets: z.object({ ok: count, warning: count, exceeded: count, unknown: count }),
})

export const packagesQuerySchema = analyzeQuerySchema.extend({
  ...pagination,
  type: packageType.optional(),
  query,
  budgetStatus: z.enum(['ok', 'warning', 'exceeded', 'unknown']).optional(),
  sortBy: z.enum(['bytes', 'name', 'budgetRatio']).default('bytes'),
  order,
})
export const packagesPageSchema = z.object({
  ...reportResult,
  ...pageResult,
  items: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: packageType,
    bytes: count,
    fileCount: count,
    moduleCount: count,
    unmeasuredFiles: count,
    budget: budgetCheckSchema.nullable(),
  })),
})

export const artifactsQuerySchema = analyzeQuerySchema.extend({
  ...pagination,
  packageId: z.string().optional(),
  moduleId: z.string().optional().describe('Exact module id from query-analyze-modules; returns its artifact placements.'),
  type: z.enum(['chunk', 'asset']).optional(),
  query,
  sortBy: z.enum(['size', 'path']).default('size'),
  order,
})
export const artifactsPageSchema = z.object({
  ...reportResult,
  ...pageResult,
  items: z.array(z.object({
    packageId: z.string(),
    packageType,
    file: z.string(),
    type: z.enum(['chunk', 'asset']),
    from: z.enum(['main', 'independent']),
    size: count.nullable(),
    gzipSize: count.optional(),
    brotliSize: count.optional(),
    isEntry: z.boolean().optional(),
    moduleCount: count,
    source: z.string().optional(),
    sourceType: sourceType.optional(),
  })),
})

export const modulesQuerySchema = analyzeQuerySchema.extend({
  ...pagination,
  packageId: z.string().optional(),
  artifact: z.string().optional(),
  sourceType: sourceType.optional(),
  query,
  duplicateOnly: z.boolean().default(false),
  sortBy: z.enum(['bytes', 'estimatedSavingBytes', 'source']).default('bytes'),
  order,
})
export const modulesPageSchema = z.object({
  ...reportResult,
  ...pageResult,
  items: z.array(z.object({
    id: z.string(),
    source: z.string(),
    sourceType,
    bytes: count.describe('Largest known module occurrence, not the sum of all copies.'),
    packageCount: count,
    fileCount: count,
    estimatedSavingBytes: count.describe('Upper-level duplication estimate, not guaranteed removable output bytes.'),
    hasIndependentPackage: z.boolean(),
    advice: z.string().optional(),
  })),
})

export const comparisonQuerySchema = z.object({
  revision,
  ...pagination,
  scope: z.enum(['package', 'file', 'module']).describe('Module scope compares recorded chunk contributions by canonical source, not all asset/source placements.'),
  packageId: z.string().optional(),
  change: change.optional(),
  query,
})
export const comparisonPageSchema = z.object({
  revision,
  currentHash: z.string(),
  previousHash: z.string().nullable(),
  available: z.boolean(),
  totals: z.object({
    currentBytes: count.nullable(),
    previousBytes: count.nullable(),
    deltaBytes: z.number().int().nullable(),
    currentUnmeasuredFiles: count,
    previousUnmeasuredFiles: count,
  }).nullable(),
  ...pageResult,
  items: z.array(z.object({
    key: z.string(),
    label: z.string(),
    change,
    currentBytes: count.nullable(),
    previousBytes: count.nullable(),
    deltaBytes: z.number().int().nullable(),
    packageId: z.string().optional(),
    packageLabel: z.string().optional(),
    file: z.string().optional(),
    moduleId: z.string().optional(),
    sourceType: sourceType.optional(),
    category: z.string().optional(),
    advice: z.string().optional(),
  })),
})

export type DashboardAnalyzeQuery = z.input<typeof analyzeQuerySchema>
export type DashboardAnalyzeSummary = z.output<typeof analyzeSummarySchema>
export type DashboardPackagesQuery = z.input<typeof packagesQuerySchema>
export type DashboardPackagesPage = z.output<typeof packagesPageSchema>
export type DashboardArtifactsQuery = z.input<typeof artifactsQuerySchema>
export type DashboardArtifactsPage = z.output<typeof artifactsPageSchema>
export type DashboardModulesQuery = z.input<typeof modulesQuerySchema>
export type DashboardModulesPage = z.output<typeof modulesPageSchema>
export type DashboardComparisonQuery = z.input<typeof comparisonQuerySchema>
export type DashboardComparisonPage = z.output<typeof comparisonPageSchema>
