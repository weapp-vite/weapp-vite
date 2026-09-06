import type { SuiteTask } from '../suiteRunner'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getIdeExhaustiveTasks, IDE_EXHAUSTIVE_OUT_OF_SCOPE_LABELS, IDE_GITHUB_ISSUES_AGGREGATE_LABEL, IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS } from '../e2e-suite-manifest'
import { createSuiteReport } from '../suiteReport'
import { runTaskSuite } from '../suiteRunner'
import { validateTaskAcceptance } from './task'

const temporaryRoots: string[] = []
const identity = { runId: 'test-run', commitSha: 'test-commit' }

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
  process.exitCode = 0
  vi.restoreAllMocks()
})

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-acceptance-test-'))
  temporaryRoots.push(root)
  return root
}

describe('strict IDE suite acceptance', () => {
  it('preserves unexecuted and out-of-scope tasks after an early failure', () => {
    const report = createSuiteReport([{ label: 'first', artifacts: [], durationMs: 1, exitCode: 1 }], 'ide-test', undefined, temporaryRoot(), {
      ...identity,
      strict: true,
      partial: false,
      plannedTasks: [{ label: 'first' }, { label: 'second' }, { label: 'swan', outOfScopeReason: 'Different host' }],
    })
    expect(report.coverage).toBe('partial')
    expect(report.summary).toMatchObject({ plannedCount: 2, executedCount: 1, failedCount: 1, notExecutedCount: 1, outOfScopeCount: 1 })
    expect(report.tasks.map(task => task.status)).toEqual(['failed', 'not-executed', 'out-of-scope'])
    const json = fs.readFileSync(path.join(report.reportDir, report.jsonFile), 'utf8')
    expect(json).not.toContain(temporaryRoots[0])
  })

  it('cannot label a filtered passing run as complete acceptance', () => {
    const report = createSuiteReport([{ label: 'selected', artifacts: [], durationMs: 1, exitCode: 0 }], 'ide-test', undefined, temporaryRoot(), {
      ...identity,
      strict: true,
      partial: true,
      plannedTasks: [{ label: 'selected' }],
    })
    expect(report.coverage).toBe('partial')
    expect(report.acceptance).toBe('incomplete')
  })

  it('does not accept a zero exit code without case reports, even with allow-failures', async () => {
    const task: SuiteTask = { label: 'missing-evidence', command: 'node', args: [] }
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runTaskSuite('acceptance-unit', [task], {
      runTask: async () => 0,
      failOnTaskFailure: false,
      writeReport: false,
      reportContext: { ...identity, strict: true, partial: false, plannedTasks: [task] },
    })
    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
    await expect(validateTaskAcceptance(task, identity)).rejects.toThrow('Missing DOM acceptance')
  })

  it('keeps only the three optional Baidu tasks outside exhaustive WeChat scope', () => {
    const tasks = getIdeExhaustiveTasks()
    expect(tasks.filter(task => task.outOfScopeReason).map(task => task.label).sort()).toEqual([...IDE_EXHAUSTIVE_OUT_OF_SCOPE_LABELS].sort())
    expect(tasks.filter(task => !task.outOfScopeReason).length).toBeGreaterThanOrEqual(86)
    const templateTask = tasks.find(task => task.label === 'ide/template-dev-open-all.runtime.test.ts')
    expect(templateTask?.acceptanceTemplates).toContain('weapp-vite-template')
    expect(new Set(templateTask?.acceptanceTemplates).size).toBe(templateTask?.acceptanceTemplates?.length)
  })

  it('requires aggregate imports to match every manifest child', () => {
    const e2eRoot = path.resolve(import.meta.dirname, '../..')
    const aggregate = path.resolve(e2eRoot, IDE_GITHUB_ISSUES_AGGREGATE_LABEL)
    const ast = ts.createSourceFile(aggregate, fs.readFileSync(aggregate, 'utf8'), ts.ScriptTarget.Latest, true)
    const importedTests = ast.statements
      .filter(ts.isImportDeclaration)
      .map(node => ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '')
      .filter(value => value.endsWith('.test'))
      .map(value => path.relative(e2eRoot, path.resolve(path.dirname(aggregate), `${value}.ts`)).replaceAll('\\', '/'))
    expect(importedTests.sort()).toEqual([...IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS].sort())
  })
})
