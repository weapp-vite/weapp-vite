import type { ProjectResult } from '../../../scripts/workspace-hmr/baseline'
import { describe, expect, it } from 'vitest'
import { shouldFallbackToSmokeForChangedFiles } from '../../../scripts/audit-workspace-hmr'
import {
  createWorkspaceHmrBaseline,
  evaluateWorkspaceHmrThresholds,
} from '../../../scripts/workspace-hmr/baseline'

const templateResult: ProjectResult = {
  id: 'templates/weapp-vite-template',
  kind: 'templates',
  platform: 'weapp',
  source: 'templates/weapp-vite-template',
  startupMs: 1_000,
  scenarios: [
    {
      id: 'native-template',
      label: 'native template',
      source: 'templates/weapp-vite-template/src/pages/index/index.wxml',
      output: 'templates/weapp-vite-template/dist/pages/index/index.wxml',
      totalMs: 400,
      profile: {
        dirtyCount: 1,
        pendingCount: 1,
        emittedCount: 1,
      },
    },
  ],
}

const githubIssuesResult: ProjectResult = {
  id: 'e2e-apps/github-issues',
  kind: 'e2e-apps',
  platform: 'weapp',
  source: 'e2e-apps/github-issues',
  scenarios: [
    {
      id: 'vue-template',
      label: 'Vue SFC template',
      source: 'e2e-apps/github-issues/src/pages/issue-398/index.vue',
      output: 'e2e-apps/github-issues/dist/pages/issue-398/index.wxml',
      totalMs: 4_000,
      profile: {
        dirtyCount: 1,
        pendingCount: 81,
        emittedCount: 81,
      },
    },
  ],
}

describe('workspace HMR changed-file selection', () => {
  it('skips smoke fallback for test-only changes without runnable project impact', () => {
    expect(shouldFallbackToSmokeForChangedFiles([
      'packages/weapp-vite/test/tabbar-appbar.test.ts',
      'packages/weapp-vite/src/runtime/buildPlugin/pluginDemo.test.ts',
    ])).toBe(false)
  })

  it('keeps smoke fallback for global runtime and dependency changes', () => {
    expect(shouldFallbackToSmokeForChangedFiles(['packages/weapp-vite/src/createContext.ts'])).toBe(true)
    expect(shouldFallbackToSmokeForChangedFiles(['pnpm-lock.yaml'])).toBe(true)
  })

  it('keeps smoke fallback when changed files cannot be resolved', () => {
    expect(shouldFallbackToSmokeForChangedFiles([])).toBe(true)
  })

  it('uses explicit github-issues baseline counts for changed-project audits', () => {
    const baseline = createWorkspaceHmrBaseline([templateResult], {
      generatedAt: '2026-04-29T00:00:00.000Z',
      mode: 'templates-baseline',
      thresholds: {
        maxPendingCount: 16,
        maxEmittedCount: 16,
        maxPendingDelta: 8,
        maxEmittedDelta: 8,
      },
    })
    baseline.projects[githubIssuesResult.id] = {
      scenarios: {
        'vue-template': {
          pendingCount: 81,
          emittedCount: 81,
        },
      },
    }

    expect(evaluateWorkspaceHmrThresholds([githubIssuesResult], { baseline }).issues).toHaveLength(0)
  })
})
