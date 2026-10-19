import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 临时 Git 仓库验证跨平台工作区状态与入口顺序。
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { createAcceptanceIdentity } from '../../e2e/scripts/domAcceptanceReport/helpers'
import { createSuiteReport } from '../../e2e/scripts/suiteReport'
import { fullRuntimeBlock } from './runtime.ts'

const roots: string[] = []
const trackedDom = 'docs/reports/dom-acceptance/committed.json'
const trackedSuite = 'docs/reports/2026-01-01-000000-e2e-ci-suite-report/index.json'

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-runtime-'))
  roots.push(root)
  const git = (args: string[]) => execa('git', args, { cwd: root })
  const readGit = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const write = async (file: string, value = '{}\n') => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), value)
  }
  await git(['init', '--quiet', '--initial-branch=main', '--template='])
  await git(['config', 'core.hooksPath', path.join(root, '.git/fixture-hooks')])
  await write('src/index.ts', 'export const ready = true\n')
  await write(trackedDom)
  await write(trackedSuite)
  await git(['add', '.'])
  await git(['-c', 'commit.gpgsign=false', '-c', 'user.name=Verification Test', '-c', 'user.email=verification@example.invalid', 'commit', '--quiet', '-m', 'fixture'])
  await git(['update-ref', 'refs/remotes/origin/main', 'HEAD'])
  return { root, git, readGit, write }
}

describe('full runtime checkout guard', () => {
  it('allows full after headless generates reports, then still rejects a source change', async () => {
    const { root, readGit, write } = await repository()
    expect(await fullRuntimeBlock(root)).toBeUndefined()
    const identity = createAcceptanceIdentity({}, readGit)
    createSuiteReport([], 'e2e:ide-dom-headless', new Date(), path.join(root, 'docs/reports'), {
      ...identity,
      strict: true,
      partial: true,
      plannedTasks: [],
    })
    await write('docs/reports/dom-acceptance/headless/invocation.json')
    expect(readGit(['status', '--porcelain'])).toContain('suite-report/')
    expect(createAcceptanceIdentity({}, readGit).workingTreeDirty).toBe(false)
    expect(await fullRuntimeBlock(root)).toBeUndefined()

    await write('src/index.ts', 'export const ready = false\n')
    expect(createAcceptanceIdentity({}, readGit).workingTreeDirty).toBe(true)
    expect(await fullRuntimeBlock(root)).toContain('干净 main')
  })

  it.each([trackedDom, trackedSuite])('rejects tracked evidence changes at %s', async (file) => {
    const { root, git, write } = await repository()
    await write(file, '{"changed":true}\n')
    expect(await fullRuntimeBlock(root)).toContain('干净 main')
    await git(['add', file])
    expect(await fullRuntimeBlock(root)).toContain('干净 main')
  })

  it('rejects staged generated evidence and untracked source files', async () => {
    const { root, git, write } = await repository()
    const report = 'docs/reports/dom-acceptance/headless/invocation.json'
    await write(report)
    await git(['add', report])
    expect(await fullRuntimeBlock(root)).toContain('干净 main')
    await git(['reset', '--quiet'])
    await write('src/new case.ts', 'export {}\n')
    expect(await fullRuntimeBlock(root)).toContain('干净 main')
  })

  it('still rejects non-main branches at the same clean revision', async () => {
    const { root, git } = await repository()
    await git(['branch', 'other'])
    await git(['symbolic-ref', 'HEAD', 'refs/heads/other'])
    expect(await fullRuntimeBlock(root)).toContain('干净 main')
  })
})
