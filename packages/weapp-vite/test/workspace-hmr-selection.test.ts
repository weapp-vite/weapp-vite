import type { ProjectResult } from '../../../scripts/workspace-hmr/baseline'
import { describe, expect, it } from 'vitest'
import {
  readWorkspaceHmrPollingMode,
  readWorkspaceHmrScope,
  readWorkspaceHmrWriteMode,
  resolveChangedProjectIds,
  selectWorkspaceHmrSmokeProjectIds,
  shouldFallbackToSmokeForChangedFiles,
} from '../../../scripts/audit-workspace-hmr'
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
  it('parses workspace HMR scope values', () => {
    expect(readWorkspaceHmrScope(undefined)).toBe('workspace')
    expect(readWorkspaceHmrScope('apps,e2e-apps')).toBe('apps,e2e-apps')
    expect(readWorkspaceHmrScope('apps')).toBe('apps')
    expect(readWorkspaceHmrScope('e2e-apps')).toBe('e2e-apps')
    expect(readWorkspaceHmrScope('templates')).toBe('templates')
    expect(readWorkspaceHmrScope('workspace')).toBe('workspace')
    expect(() => readWorkspaceHmrScope('apps,templates')).toThrow('Invalid WORKSPACE_HMR_SCOPE')
  })

  it('parses workspace HMR write mode values', () => {
    expect(readWorkspaceHmrWriteMode(undefined)).toBe('write')
    expect(readWorkspaceHmrWriteMode('write')).toBe('write')
    expect(readWorkspaceHmrWriteMode('rename')).toBe('rename')
    expect(() => readWorkspaceHmrWriteMode('atomic')).toThrow('Invalid WORKSPACE_HMR_WRITE_MODE')
  })

  it('parses workspace HMR polling mode values', () => {
    expect(readWorkspaceHmrPollingMode(undefined)).toBe('native')
    expect(readWorkspaceHmrPollingMode('0')).toBe('native')
    expect(readWorkspaceHmrPollingMode('false')).toBe('native')
    expect(readWorkspaceHmrPollingMode('1')).toBe('polling')
    expect(readWorkspaceHmrPollingMode('true')).toBe('polling')
    expect(() => readWorkspaceHmrPollingMode('yes')).toThrow('Invalid WORKSPACE_HMR_USE_POLLING')
  })

  it('selects changed projects only from the requested apps and e2e-apps scope', () => {
    expect([...resolveChangedProjectIds([
      'apps/hmr-lab/src/pages/index/index.vue',
      'e2e-apps/base/src/pages/index/index.vue',
      'templates/weapp-vite-template/src/pages/index/index.ts',
    ], 'apps,e2e-apps')]).toEqual([
      'apps/hmr-lab',
      'e2e-apps/base',
    ])
  })

  it('selects changed projects from apps, templates, and e2e-apps in workspace scope', () => {
    expect([...resolveChangedProjectIds([
      'apps/hmr-lab/src/pages/index/index.vue',
      'e2e-apps/base/src/pages/index/index.vue',
      'templates/weapp-vite-template/src/pages/index/index.ts',
    ], 'workspace')]).toEqual([
      'apps/hmr-lab',
      'e2e-apps/base',
      'templates/weapp-vite-template',
    ])
  })

  it('ignores release-only project metadata changes for changed-project audits', () => {
    expect([...resolveChangedProjectIds([
      '.changeset/fair-wevu-vendors-hmr.md',
      'apps/wevu-comprehensive-demo/CHANGELOG.md',
      'apps/wevu-comprehensive-demo/package.json',
      'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/CHANGELOG.md',
      'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/package.json',
    ], 'workspace')]).toEqual([])
  })

  it('selects representative smoke projects from apps and e2e-apps scope', () => {
    expect([...selectWorkspaceHmrSmokeProjectIds([
      { id: 'apps/hmr-lab', kind: 'apps' },
      { id: 'apps/runtime-bench-vue', kind: 'apps' },
      { id: 'templates/weapp-vite-template', kind: 'templates' },
      { id: 'e2e-apps/base', kind: 'e2e-apps' },
      { id: 'e2e-apps/wevu-features', kind: 'e2e-apps' },
    ], 'apps,e2e-apps')]).toEqual([
      'apps/hmr-lab',
      'e2e-apps/base',
    ])
  })

  it('selects representative smoke projects from every workspace root', () => {
    expect([...selectWorkspaceHmrSmokeProjectIds([
      { id: 'apps/hmr-lab', kind: 'apps' },
      { id: 'apps/runtime-bench-vue', kind: 'apps' },
      { id: 'templates/weapp-vite-template', kind: 'templates' },
      { id: 'templates/weapp-vite-wevu-template', kind: 'templates' },
      { id: 'e2e-apps/base', kind: 'e2e-apps' },
      { id: 'e2e-apps/wevu-features', kind: 'e2e-apps' },
    ], 'workspace')]).toEqual([
      'apps/hmr-lab',
      'templates/weapp-vite-template',
      'e2e-apps/base',
    ])
  })

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
