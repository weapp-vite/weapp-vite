import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createVerificationIdentity } from '../../e2e/scripts/verification/plan'
import { readWorkflowFixture } from '../workflowFixture.mjs'

it('keeps generated preflight logs outside source identity while retaining tracked evidence and report sources', async () => {
  const workflow = readWorkflowFixture('reusable-miniapp-platform.yml') as {
    jobs: Record<string, { with?: { main_command?: string } }>
  }
  const cleanupCommand = workflow.jobs['ide-dom-headless']!.with!.main_command!
    .split('\n')
    .find(command => command.includes('pnpm vitest run'))!
  const log = cleanupCommand.match(/\| tee (\S+)$/)?.[1]
  expect(log).toBe('.tmp/ide-dom-headless-preflight/cleanup.log')

  const root = await mkdtemp(path.join(os.tmpdir(), 'headless-preflight-identity-'))
  const readGit = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const write = async (file: string, content: string) => {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  try {
    readGit(['init', '--quiet', '--initial-branch=fixture', '--template='])
    readGit(['config', 'core.hooksPath', path.join(root, '.git/fixture-hooks')])
    await write('.gitignore', await readFile(new URL('../../.gitignore', import.meta.url), 'utf8'))
    readGit(['add', '.gitignore'])
    readGit(['-c', 'commit.gpgsign=false', '-c', 'user.name=Verification Test', '-c', 'user.email=verification@example.invalid', 'commit', '--quiet', '-m', 'fixture'])
    const before = createVerificationIdentity({}, readGit)
    expect(before.workingTreeDirty).toBe(false)

    await write(log!, 'preflight evidence\n')
    const after = createVerificationIdentity({}, readGit)
    expect(after.commitSha).toBe(before.commitSha)
    expect(after.workingTreeDirty).toBe(false)

    const reportSource = 'docs/reports/ide-dom-headless-preflight/review.ts'
    await write(reportSource, 'export {}\n')
    expect(createVerificationIdentity({}, readGit).workingTreeDirty).toBe(true)
    await rm(path.join(root, reportSource))

    readGit(['add', '--force', log!])
    expect(createVerificationIdentity({}, readGit).workingTreeDirty).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
