import { expect, it } from 'vitest'
import { verifyFrozenDocumentation } from '../../.github/scripts/lint-frozen-documentation.mjs'
import { isRootPolicyDocument, requiredDocumentContracts, rootDocumentationChanges } from './documentPolicy.mjs'

it('assigns only known root documents to standalone static validation', () => {
  for (const file of ['CONTRIBUTING.md', 'AGENTS.md', 'AGENTS.local.md', 'README.md', 'README.en.md', 'LICENSE', 'LICENSE.md']) {
    expect(isRootPolicyDocument(file)).toBe(true)
  }
  for (const file of ['packages/core/README.md', 'docs/guide.md', 'website/index.md', 'scripts/generate-agents.mjs', 'pnpm-lock.yaml', 'README.md/package.json', 'README.unknown.json']) {
    expect(isRootPolicyDocument(file)).toBe(false)
  }
})

it('checks both rename sides, deletes, unknown inputs and listing truncation', () => {
  expect(rootDocumentationChanges([{ filename: 'CONTRIBUTING.md', status: 'modified' }])).toEqual(['CONTRIBUTING.md'])
  expect(rootDocumentationChanges([{ filename: 'AGENTS.local.md', status: 'removed' }])).toEqual([])
  expect(rootDocumentationChanges([{ filename: 'README.en.md', previous_filename: 'README.md', status: 'renamed' }])).toEqual(['README.en.md'])
  for (const files of [[], null, [{ filename: 'README.md' }], [{ filename: 'README.md', status: 'renamed' }], [{ filename: 'README.md', previous_filename: 'src/index.ts', status: 'renamed' }], [{ filename: 'CONTRIBUTING.md', status: 'modified' }, { filename: 'pnpm-lock.yaml', status: 'modified' }], Array.from({ length: 3000 }, () => ({ filename: 'README.md', status: 'modified' }))]) {
    expect(rootDocumentationChanges(files)).toBeNull()
  }
})

it('retains only applicable generated document and public skill contracts', () => {
  expect(requiredDocumentContracts(['CONTRIBUTING.md', 'AGENTS.local.md', 'README.md', 'LICENSE'])).toEqual([])
  expect(requiredDocumentContracts(['AGENTS.md'])).toEqual(['agents', 'skills'])
  expect(requiredDocumentContracts(['packages/weapp-vite/AGENTS.md', 'scripts/agents/content/root-intro.md'])).toEqual(['agents'])
  expect(requiredDocumentContracts(['skills/example/SKILL.md', 'skills/scripts/check-public-skill-sync.mjs'])).toEqual(['skills'])
  expect(requiredDocumentContracts(['packages/create-weapp-vite/src/generated/agents.ts'])).toEqual(['agents'])
  expect(requiredDocumentContracts(['website/guide/skills.md'])).toEqual(['skills'])
})

it('checks deleted or renamed generated targets even when no lint path survives', async () => {
  const calls = []
  const run = async (command, args) => {
    calls.push({ command, args })
  }
  await verifyFrozenDocumentation([], requiredDocumentContracts(['AGENTS.md']), run)
  expect(calls.map(call => call.args)).toEqual([['run', 'agents:check'], ['run', 'skills:check']])
  calls.length = 0
  await verifyFrozenDocumentation([], [], run)
  expect(calls).toEqual([])
  await verifyFrozenDocumentation(['README.md'], [], run)
  expect(calls[0].args).toEqual(['node_modules/eslint/bin/eslint.js', 'README.md'])
  await expect(verifyFrozenDocumentation([], ['arbitrary-command'], run)).rejects.toThrow('Invalid frozen documentation checks')
  await expect(verifyFrozenDocumentation(['scripts/input.mjs'], [], run)).rejects.toThrow('Invalid frozen documentation paths')
})
