import type { ReadDashboardQuerySnapshot } from './shared'
import { defineRpcFunction } from 'devframe'
import { compareAnalyzeBuilds, getAnalyzeSummary } from './analysis'
import { queryAnalyzeArtifacts, queryAnalyzeModules, queryAnalyzePackages } from './catalog'
import {
  analyzeQuerySchema,
  analyzeSummarySchema,
  artifactsPageSchema,
  artifactsQuerySchema,
  comparisonPageSchema,
  comparisonQuerySchema,
  modulesPageSchema,
  modulesQuerySchema,
  packagesPageSchema,
  packagesQuerySchema,
} from './schema'

export function createDashboardAnalyzeQueries(read: ReadDashboardQuerySnapshot) {
  return {
    summary: defineRpcFunction({
      name: 'get-analyze-summary',
      type: 'query',
      jsonSerializable: true,
      args: [analyzeQuerySchema],
      returns: analyzeSummarySchema,
      agent: {
        title: 'Analyze summary and budgets',
        safety: 'read',
        description: 'Start diagnostics here: report totals, total budget and package budget-status counts without downloading JSON pages. Bytes sum known artifact sizes; unmeasuredFiles identifies incomplete size data. Use package queries to locate budget warnings.',
      },
      handler: input => getAnalyzeSummary(read, input),
    }),
    packages: defineRpcFunction({
      name: 'query-analyze-packages',
      type: 'query',
      jsonSerializable: true,
      args: [packagesQuerySchema],
      returns: packagesPageSchema,
      agent: {
        title: 'Analyze packages',
        safety: 'read',
        description: 'Filter packages by type, name or budget status; sort by size, name or budget ratio. Returns bounded rows and nextOffset pinned to a report revision/hash. Select a package id to inspect artifacts and modules.',
      },
      handler: input => queryAnalyzePackages(read, input),
    }),
    artifacts: defineRpcFunction({
      name: 'query-analyze-artifacts',
      type: 'query',
      jsonSerializable: true,
      args: [artifactsQuerySchema],
      returns: artifactsPageSchema,
      agent: {
        title: 'Analyze artifacts and module placements',
        safety: 'read',
        description: 'Find largest artifacts or locate an exact module id within emitted files. Filter by package, module, type or path. Rows omit nested module arrays. Read an artifact excerpt using read-dashboard-file with its file path and the current revision; previous artifacts are metadata only.',
      },
      handler: input => queryAnalyzeArtifacts(read, input),
    }),
    modules: defineRpcFunction({
      name: 'query-analyze-modules',
      type: 'query',
      jsonSerializable: true,
      args: [modulesQuerySchema],
      returns: modulesPageSchema,
      agent: {
        title: 'Analyze modules and duplicates',
        safety: 'read',
        description: 'Filter modules by source, package, artifact or duplicate membership, then sort by bytes or estimated duplication savings. Bytes represent the largest known occurrence. Savings are estimates, not guaranteed removable bytes; independent packages may require isolation. Query artifacts with a module id for placements, not a source-import causal chain.',
      },
      handler: input => queryAnalyzeModules(read, input),
    }),
    comparison: defineRpcFunction({
      name: 'compare-analyze-builds',
      type: 'query',
      jsonSerializable: true,
      args: [comparisonQuerySchema],
      returns: comparisonPageSchema,
      agent: {
        title: 'Compare current and previous builds',
        safety: 'read',
        description: 'Read bounded package, file or canonical-module additions, removals, growth and shrinkage, ordered by absolute delta. Totals always describe whole-build artifact sizes; module and file deltas overlap and must not be added together. No previous snapshot returns available:false and totals:null, not an empty baseline.',
      },
      handler: input => compareAnalyzeBuilds(read, input),
    }),
  }
}
