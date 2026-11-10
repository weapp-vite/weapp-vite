import assert from 'node:assert/strict'
import { it } from 'vitest'
import {
  collectConstantsChangesetIssues,
  resolveConstantsReleaseBaseRef,
} from './check-weapp-core-constants-changeset'

it('rejects constants source changes without a constants changeset', () => {
  const issues = collectConstantsChangesetIssues({
    changedConstantsFiles: ['@weapp-core/constants/src/index.ts'],
    changesetPackages: new Set(['weapp-vite', 'create-weapp-vite']),
  })

  assert.equal(issues.length, 1)
  assert.match(issues[0]!, /Missing changeset for @weapp-core\/constants/)
})

it('accepts constants source changes with a constants changeset', () => {
  assert.deepEqual(
    collectConstantsChangesetIssues({
      changedConstantsFiles: ['@weapp-core/constants/src/index.ts'],
      changesetPackages: new Set(['@weapp-core/constants']),
    }),
    [],
  )
})

it('ignores unrelated changes when no constants files changed', () => {
  assert.deepEqual(
    collectConstantsChangesetIssues({
      changedConstantsFiles: ['packages/weapp-vite/src/vite/slots.ts'],
      changesetPackages: new Set(),
    }),
    [],
  )
})

it('uses the published constants tag as the release baseline', () => {
  assert.equal(
    resolveConstantsReleaseBaseRef('0.5.2', true),
    '@weapp-core/constants@0.5.2',
  )
})

it('uses HEAD when constants has no published tag yet', () => {
  assert.equal(resolveConstantsReleaseBaseRef('0.0.1', false), 'HEAD')
})
