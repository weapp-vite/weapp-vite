import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import {
  formatCatalogUpgradeSummary,
  shouldWriteCatalogUpgradeChangeset,
} from './generate-catalog-changeset'

it('shouldWriteCatalogUpgradeChangeset detects default and named catalog edits', () => {
  assert.equal(shouldWriteCatalogUpgradeChangeset([], {}), false)
  assert.equal(shouldWriteCatalogUpgradeChangeset(['vitest'], {}), true)
  assert.equal(
    shouldWriteCatalogUpgradeChangeset([], { runtime: new Set(['wevu']) }),
    true,
  )
})

it('formatCatalogUpgradeSummary describes catalog key changes in Chinese', () => {
  assert.equal(
    formatCatalogUpgradeSummary(['vitest', 'rolldown'], { runtime: new Set(['wevu']) }),
    `基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：vitest, rolldown。命名 catalog 变更键：runtime(wevu)。
`,
  )
  assert.equal(
    formatCatalogUpgradeSummary([], {}),
    `基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：无。命名 catalog 变更键：无。
`,
  )
})

it('catalog upgrade generator does not overwrite or delete a fixed changeset path', async () => {
  const source = await fs.readFile(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'generate-catalog-changeset.ts'),
    'utf8',
  )

  assert.equal(source.includes('catalog-auto-generated.md'), false)
  assert.equal(source.includes('fs.rm'), false)
  assert.match(source, /writeUniqueChangeset/)
  assert.match(source, /collectPublishableWorkspacePackages/)
})
