import type { DevframeRpcServerFunctions } from 'devframe'
import type {
  DashboardAnalyzeSummary,
  DashboardArtifactsPage,
  DashboardComparisonPage,
  DashboardFileContent,
  DashboardModulesPage,
  DashboardPackagesPage,
  DashboardRuntimeEventsPage,
} from 'weapp-vite/dashboard'
import { expectError, expectType } from 'tsd'
import 'weapp-vite/dashboard'

declare const rpc: DevframeRpcServerFunctions
expectType<DashboardAnalyzeSummary>(rpc['weapp-vite:get-analyze-summary']({ revision: 0 }))
expectType<DashboardPackagesPage>(rpc['weapp-vite:query-analyze-packages']({ revision: 0, budgetStatus: 'exceeded', limit: 10 }))
expectType<DashboardArtifactsPage>(rpc['weapp-vite:query-analyze-artifacts']({ revision: 0, target: 'previous', moduleId: 'shared' }))
expectType<DashboardModulesPage>(rpc['weapp-vite:query-analyze-modules']({ revision: 0, duplicateOnly: true, sortBy: 'estimatedSavingBytes' }))
const comparison = rpc['weapp-vite:compare-analyze-builds']({ revision: 0, scope: 'module', change: 'removed' })
expectType<DashboardComparisonPage>(comparison)
expectType<number | null | undefined>(comparison.totals?.deltaBytes)
expectType<number | undefined>(comparison.totals?.currentUnmeasuredFiles)
expectType<number | null>(comparison.items[0]!.currentBytes)
expectType<DashboardComparisonPage>(rpc['weapp-vite:compare-analyze-builds']({ revision: 0, scope: 'file', change: 'unmeasured' }))
expectType<DashboardRuntimeEventsPage>(rpc['weapp-vite:query-runtime-events']({ kind: 'hmr', since: '2026-01-01T00:00:00Z' }))
expectType<Promise<DashboardFileContent>>(rpc['weapp-vite:read-dashboard-file']({ revision: 0, kind: 'artifact', path: 'app.js', range: { offset: 2, limit: 100 } }))

declare const content: DashboardFileContent
expectType<number | null | undefined>(content.range?.nextOffset)
expectError(rpc['weapp-vite:get-analyze-summary']({}))
expectError(rpc['weapp-vite:query-analyze-packages']({ revision: 0, budgetStatus: 'critical' }))
expectError(rpc['weapp-vite:query-analyze-artifacts']({ revision: 0, type: 'module' }))
expectError(rpc['weapp-vite:query-analyze-modules']({ revision: 0, sortBy: 'hash' }))
expectError(rpc['weapp-vite:compare-analyze-builds']({ revision: 0 }))
expectError(rpc['weapp-vite:query-runtime-events']({ kind: 'unknown' }))
expectError(rpc['weapp-vite:read-dashboard-file']({ revision: 0, kind: 'artifact', path: 'app.js', range: { offset: 0 } }))
