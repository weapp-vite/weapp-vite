import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = path.join(repoRoot, 'scripts/check-changeset-frontmatter.mjs')

async function createFixture(changesetPackageName: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'changeset-frontmatter-'))
  await fs.mkdir(path.join(root, '.changeset'), { recursive: true })
  await fs.mkdir(path.join(root, 'packages/known'), { recursive: true })
  await fs.writeFile(
    path.join(root, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - packages/*',
      '  - \'!packages/**/test/**\'',
      '',
    ].join('\n'),
  )
  await fs.writeFile(
    path.join(root, 'packages/known/package.json'),
    JSON.stringify({ name: '@scope/known', version: '1.0.0' }),
  )
  await fs.writeFile(
    path.join(root, '.changeset/example.md'),
    [
      '---',
      `"${changesetPackageName}": patch`,
      '---',
      '',
      'summary',
    ].join('\n'),
  )

  return root
}

it('check-changeset-frontmatter rejects unknown workspace package names', async () => {
  const root = await createFixture('known')

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--root', root], {
      encoding: 'utf8',
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /不存在的 workspace package/)
    assert.match(result.stderr, /\.changeset\/example\.md: known/)
  }
  finally {
    await fs.rm(root, { force: true, recursive: true })
  }
})

it('check-changeset-frontmatter accepts real workspace package names', async () => {
  const root = await createFixture('@scope/known')

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--root', root], {
      encoding: 'utf8',
    })

    assert.equal(result.status, 0)
    assert.match(result.stdout, /check passed/)
  }
  finally {
    await fs.rm(root, { force: true, recursive: true })
  }
})
