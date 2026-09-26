import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import {
  allocateUniqueChangesetPath,
  collectAllChangesetPackages,
  formatChangesetMarkdown,
  formatChangesetTimestamp,
  listChangesetMarkdownFiles,
  writeUniqueChangeset,
} from './changeset-utils'

it('formatChangesetTimestamp uses local YYYYMMDD-HHmmss', () => {
  assert.equal(formatChangesetTimestamp(new Date(2026, 8, 17, 14, 30, 52)), '20260917-143052')
})

it('allocateUniqueChangesetPath appends a suffix instead of overwriting', () => {
  const now = new Date(2026, 8, 17, 14, 30, 52)
  const first = allocateUniqueChangesetPath({
    changesetDir: '.changeset',
    prefix: 'dependency-upgrade',
    existingNames: [],
    now,
  })
  const second = allocateUniqueChangesetPath({
    changesetDir: '.changeset',
    prefix: 'dependency-upgrade',
    existingNames: [first],
    now,
  })
  const third = allocateUniqueChangesetPath({
    changesetDir: '.changeset',
    prefix: 'dependency-upgrade',
    existingNames: [first, second],
    now,
  })

  assert.equal(path.basename(first), 'dependency-upgrade-20260917-143052.md')
  assert.equal(path.basename(second), 'dependency-upgrade-20260917-143052-2.md')
  assert.equal(path.basename(third), 'dependency-upgrade-20260917-143052-3.md')
})

it('formatChangesetMarkdown sorts unique package names into patch frontmatter', () => {
  const markdown = formatChangesetMarkdown(['wevu', 'weapp-vite', 'wevu'], 'patch', '摘要')
  assert.equal(markdown, `---
'weapp-vite': patch
'wevu': patch
---

摘要
`)
})

it('writeUniqueChangeset creates a new file and leaves previous files intact', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-changeset-'))
  const now = new Date(2026, 8, 17, 14, 30, 52)

  try {
    await fs.writeFile(path.join(dir, 'README.md'), 'keep\n', 'utf8')
    const first = await writeUniqueChangeset({
      changesetDir: dir,
      prefix: 'dependency-upgrade',
      packages: ['weapp-vite'],
      bumpType: 'patch',
      body: '第一批',
      now,
    })
    const firstContent = await fs.readFile(first, 'utf8')
    const second = await writeUniqueChangeset({
      changesetDir: dir,
      prefix: 'dependency-upgrade',
      packages: ['wevu'],
      bumpType: 'patch',
      body: '第二批',
      now,
    })

    assert.notEqual(first, second)
    assert.equal(await fs.readFile(first, 'utf8'), firstContent)
    assert.match(path.basename(second), /dependency-upgrade-20260917-143052-2\.md$/)
    assert.equal(
      await fs.readFile(path.join(dir, 'README.md'), 'utf8'),
      'keep\n',
    )

    const files = await listChangesetMarkdownFiles(dir)
    assert.deepEqual(
      files.map(file => path.basename(file)).sort(),
      [
        'dependency-upgrade-20260917-143052-2.md',
        'dependency-upgrade-20260917-143052.md',
      ],
    )

    const packages = await collectAllChangesetPackages(dir)
    assert.deepEqual([...packages].sort(), ['weapp-vite', 'wevu'])
  }
  finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
