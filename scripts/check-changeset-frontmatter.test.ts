import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = path.join(repoRoot, 'scripts/check-changeset-frontmatter.mjs')

async function createFixture(changesetPackageName: string, body = 'fix: 修复公开包的行为') {
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
      body,
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

it.each([
  'feat',
  'fix',
  'perf',
  'chore',
  'docs',
  'refactor',
  'test',
  'build',
  'ci',
  'style',
  'revert',
])('check-changeset-frontmatter accepts the %s summary type', async (type) => {
  const root = await createFixture('@scope/known', `${type}: 更新公开包的契约`)

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--root', root], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  finally {
    await fs.rm(root, { force: true, recursive: true })
  }
})

it.each([
  'fix(runtime): 修复首次挂载',
  'feat!: 更新公开接口',
  'feat(runtime)!: 更新公开接口',
  '\n \nperf(compiler): 减少重复分析\n\n- 保留错误恢复。',
])('check-changeset-frontmatter accepts scope, breaking markers and details: %s', async (body) => {
  const root = await createFixture('@scope/known', body)

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--root', root], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  finally {
    await fs.rm(root, { force: true, recursive: true })
  }
})

it.each([
  '',
  '修复首次挂载',
  'feature: 增加公开接口',
  'unknown: 更新公开包',
  'fix:',
  'fix:   ',
  'fix(runtime):\n\n- 修复首次挂载。',
  'fix(): 修复首次挂载',
  'fix( ): 修复首次挂载',
  '修复首次挂载\n\nfix: 修复后续导航',
])('check-changeset-frontmatter rejects an invalid first summary line: %s', async (body) => {
  const root = await createFixture('@scope/known', body)

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--root', root], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Conventional 类型或非空摘要/)
    assert.match(result.stderr, /\.changeset\/example\.md/)
  }
  finally {
    await fs.rm(root, { force: true, recursive: true })
  }
})

it.each([
  'fix: 修复首次挂载',
  '---\n"@scope/known": patch\n\nfix: 修复首次挂载',
])('check-changeset-frontmatter still rejects malformed frontmatter: %s', async (content) => {
  const root = await createFixture('@scope/known')

  try {
    await fs.writeFile(path.join(root, '.changeset/example.md'), content)
    const result = spawnSync(process.execPath, [scriptPath, '--root', root], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /frontmatter 格式无效/)
  }
  finally {
    await fs.rm(root, { force: true, recursive: true })
  }
})
