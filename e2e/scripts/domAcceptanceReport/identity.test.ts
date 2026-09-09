import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSuiteReport } from '../suiteReport'
import { createAcceptanceIdentity } from './helpers'

describe('acceptance identity with a real Git worktree', () => {
  let directory = ''
  const trackedReport = 'docs/reports/dom-acceptance/committed.json'
  const trackedSuiteReport = 'docs/reports/2026-01-01-000000-e2e-ci-1234abcd-suite-report/index.json'

  function git(args: string[]) {
    return execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Acceptance Fixture',
        GIT_AUTHOR_EMAIL: 'acceptance@example.invalid',
        GIT_COMMITTER_NAME: 'Acceptance Fixture',
        GIT_COMMITTER_EMAIL: 'acceptance@example.invalid',
      },
    })
  }

  function write(file: string, contents = '{}') {
    const target = path.join(directory, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, contents)
  }

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-identity-git-'))
    git(['init', '--quiet', '--template='])
    git(['config', 'core.hooksPath', path.join(directory, '.git/fixture-hooks')])
    write('src/index.ts', 'export const ready = true\n')
    write(trackedReport)
    write(trackedSuiteReport)
    git(['add', '.'])
    git(['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'test: initialize identity fixture'])
  })

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }))

  it('keeps a clean checkout clean after generating nested acceptance evidence', () => {
    expect(createAcceptanceIdentity({}, git)).toMatchObject({ commitSha: git(['rev-parse', 'HEAD']).trim(), workingTreeDirty: false })
    write('docs/reports/dom-acceptance/run/invocation.json')
    write('docs/reports/dom-acceptance/run/evidence file.png', 'screenshot')
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(false)
  })

  it('keeps actual suite generator output and legacy suite indexes clean', () => {
    const identity = createAcceptanceIdentity({}, git)
    createSuiteReport([], 'e2e:ide:full:exhaustive', new Date(2026, 0, 2, 3, 4, 5), path.join(directory, 'docs/reports'), {
      ...identity,
      strict: true,
      partial: false,
      plannedTasks: [],
    })
    write('docs/reports/2026-01-02-030405-e2e-ide-full-exhaustive-suite-report/index.json')
    write('docs/reports/2026-01-02-030405-e2e-ide-full-exhaustive-suite-report/index.md')
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(false)
  })

  it.each([
    'src/new case.ts',
    'docs/reports/review.md',
    'docs/reports/dom-acceptance-notes.md',
    'docs/reports/dom-acceptance-other/run.json',
    'nested/docs/reports/dom-acceptance/run.json',
    ' docs/reports/dom-acceptance/run.json',
    'docs/reports/review-suite-report/index.md',
    'docs/reports/2026-01-02-030405-e2e-ci-1234abcd-suite-report/source.ts',
    'docs/reports/2026-01-02-030405-e2e-ci-1234abcd-suite-report/index.json.backup',
    'docs/reports/2026-01-02-030405-e2e-ci-1234abcd-suite-report/nested/index.json',
    'docs/reports/2026-01-02-030405-e2e-ci-1234abcd-suite-report-other/index.json',
    'nested/docs/reports/2026-01-02-030405-e2e-ci-1234abcd-suite-report/index.json',
    ' docs/reports/2026-01-02-030405-e2e-ci-1234abcd-suite-report/index.json',
  ])('retains untracked non-evidence changes at %s', (file) => {
    write('docs/reports/dom-acceptance/run/invocation.json')
    write(file)
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(true)
  })

  it.each([false, true])('retains modified tracked reports with staged=%s', (staged) => {
    write(trackedReport, '{"changed":true}')
    if (staged) {
      git(['add', trackedReport])
    }
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(true)
  })

  it.each([false, true])('retains modified tracked suite indexes with staged=%s', (staged) => {
    write(trackedSuiteReport, '{"changed":true}')
    if (staged) {
      git(['add', trackedSuiteReport])
    }
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(true)
  })

  it('retains deleted and renamed tracked reports', () => {
    fs.rmSync(path.join(directory, trackedReport))
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(true)
    write('docs/reports/dom-acceptance/renamed.json')
    git(['add', '--all'])
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(true)
  })

  it('retains newly staged reports even under the generated evidence directory', () => {
    const file = 'docs/reports/dom-acceptance/run/invocation.json'
    write(file)
    git(['add', file])
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(true)
  })

  it('does not hide source files when a custom report directory points at source', () => {
    write('src/new.ts', 'export const added = true\n')
    const env = { WEAPP_VITE_E2E_ACCEPTANCE_REPORT_DIR: path.join(directory, 'src') }
    expect(createAcceptanceIdentity(env, git).workingTreeDirty).toBe(true)
  })

  it.each([false, true])('retains tracked source changes with staged=%s', (staged) => {
    write('src/index.ts', 'export const ready = false\n')
    write('docs/reports/dom-acceptance/run/invocation.json')
    if (staged) {
      git(['add', 'src/index.ts'])
    }
    expect(createAcceptanceIdentity({}, git).workingTreeDirty).toBe(true)
  })
})
