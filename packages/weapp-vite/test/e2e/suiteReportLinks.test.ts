import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createSuiteReport } from '../../../../e2e/scripts/suiteReport'

const repoRoot = path.resolve(import.meta.dirname, '../../../..')
const temporaryDirectories: string[] = []

function temporaryDirectory(parent: string) {
  fs.mkdirSync(parent, { recursive: true })
  const directory = fs.mkdtempSync(path.join(parent, 'suite-links-'))
  temporaryDirectories.push(directory)
  return directory
}

function writeChild(directory: string, name: string) {
  const target = path.join(directory, name, 'index.json')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, '{}\n')
  return target
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

it.each([false, true])('preserves portable child references with an external suite directory: %s', (externalSuite) => {
  const directory = temporaryDirectory(path.join(repoRoot, '.tmp'))
  const reportsRoot = path.join(directory, 'docs/reports')
  const failedChild = writeChild(reportsRoot, 'dom-acceptance/failed')
  const passedChild = writeChild(reportsRoot, 'dom-acceptance/passed')
  const suiteRoot = externalSuite ? temporaryDirectory(os.tmpdir()) : reportsRoot
  const tasks = [
    { label: `failed ${repoRoot}`, exitCode: 1, durationMs: 1, artifacts: [{ kind: 'dom-acceptance-report' as const, indexPath: failedChild }] },
    { label: 'passed', exitCode: 0, durationMs: 1, artifacts: [{ kind: 'dom-acceptance-report' as const, indexPath: path.relative(repoRoot, passedChild) }] },
  ]
  const report = createSuiteReport(tasks, 'link-regression', undefined, suiteRoot, {
    runId: 'link-regression',
    commitSha: 'fixture',
    workingTreeDirty: false,
    strict: true,
    partial: false,
    plannedTasks: tasks,
  })
  const markdown = fs.readFileSync(path.join(report.reportDir, report.markdownFile), 'utf8')
  const links = [...markdown.matchAll(/\[index\.json\]\(([^)]+)\)/g)].map(match => match[1]!)
  if (externalSuite) {
    expect(links).toHaveLength(0)
    for (const child of [failedChild, passedChild]) {
      expect(markdown).toContain(`\`${path.relative(repoRoot, child).replaceAll('\\', '/')}\``)
    }
  }
  else {
    expect(links).toHaveLength(3)
    expect(links.map(link => path.resolve(report.reportDir, link))).toEqual([failedChild, failedChild, passedChild])
    expect(links.every(link => !link.includes('\\'))).toBe(true)
    expect(links.every(link => fs.existsSync(path.resolve(report.reportDir, link)))).toBe(true)
  }
  expect(markdown).not.toContain(repoRoot)
  expect(markdown).toContain('failed <repo>')
  const json = JSON.parse(fs.readFileSync(path.join(report.reportDir, report.jsonFile), 'utf8')) as { tasks: Array<{ artifacts: Array<{ indexPath: string }> }> }
  expect(json.tasks.map(task => task.artifacts[0]!.indexPath)).toEqual([failedChild, passedChild].map(file => path.relative(repoRoot, file).replaceAll('\\', '/')))
})

it('keeps external child reports as redacted text instead of a broken link', () => {
  const directory = temporaryDirectory(path.join(repoRoot, '.tmp'))
  const externalDirectory = temporaryDirectory(os.tmpdir())
  const child = writeChild(externalDirectory, 'outside')
  const tasks = [{ label: 'external', exitCode: 0, durationMs: 1, artifacts: [{ kind: 'suite-report' as const, indexPath: child }] }]
  const report = createSuiteReport(tasks, 'external-link', undefined, directory, {
    runId: 'link-regression',
    commitSha: 'fixture',
    workingTreeDirty: false,
    strict: true,
    partial: false,
    plannedTasks: tasks,
  })
  const markdown = fs.readFileSync(path.join(report.reportDir, report.markdownFile), 'utf8')
  expect(markdown).toContain('`<external>/index.json`')
  expect(markdown).not.toContain('[index.json]')
  expect(markdown).not.toContain(externalDirectory)
})
