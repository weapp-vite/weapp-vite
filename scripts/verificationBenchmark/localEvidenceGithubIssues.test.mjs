import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { afterEach, expect, it } from 'vitest'
import { GITHUB_ISSUES_BUILD_BASELINE_LABEL, GITHUB_ISSUES_BUILD_GROUPS, GITHUB_ISSUES_BUILD_TASK_LABELS } from '../../e2e/ci/githubIssuesBuild/groups.ts'
import { resolveVerificationTopology, topologyEnvironment } from '../verification/topology.ts'
import { collectLocalEvidence } from './localEvidence.mjs'
import { localEvidenceFixture } from './localEvidenceFixture.mjs'
import { localDigest, localSave } from './localIo.mjs'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function sourceCases() {
  const root = path.resolve(import.meta.dirname, '../../e2e/ci/githubIssuesBuild')
  const cases = []
  for (const directory of ['cases', 'legacy/cases']) {
    for (const file of (await readdir(path.join(root, directory))).filter(file => file.endsWith('.case.ts'))) {
      const source = ts.createSourceFile(file, await readFile(path.join(root, directory, file), 'utf8'), ts.ScriptTarget.Latest, true)
      let group
      const visit = (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'group') {
          group = node.initializer?.text
        }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'it') {
          cases.push({ group, name: `e2e app: github-issues (build) > ${node.arguments[0].text}` })
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  expect(cases).toHaveLength(99)
  expect(new Set(cases.map(item => item.name)).size).toBe(99)
  return cases
}

async function githubIssuesFixture(topology) {
  const value = await localEvidenceFixture()
  roots.push(value.root)
  const executionTopology = resolveVerificationTopology(topology, {})
  value.identity.executionTopology = executionTopology
  value.plan.executionTopology = executionTopology
  value.report.executionTopology = executionTopology
  for (const task of value.plan.tasks) {
    task.env = topologyEnvironment(executionTopology)
    const file = path.join(value.directory, 'tasks', task.id.replaceAll(':', '-'), 'receipt.json')
    const receipt = JSON.parse(await readFile(file, 'utf8'))
    Object.assign(receipt, { executionTopology, effectiveTopology: task.env })
    await localSave(file, receipt)
  }
  await localSave(path.join(value.directory, 'verification/plan.json'), value.plan)
  await localSave(path.join(value.directory, 'verification/report.json'), value.report)
  const inventory = await sourceCases()
  const groups = topology === 'optimized-v2' ? GITHUB_ISSUES_BUILD_GROUPS : [null]
  const documents = []
  const original = JSON.parse(await readFile(path.join(value.directory, 'vitest/ci.json'), 'utf8'))
  await rm(path.join(value.directory, 'vitest/ci.json'))
  for (const [index, group] of groups.entries()) {
    const label = group ? GITHUB_ISSUES_BUILD_TASK_LABELS[index] : GITHUB_ISSUES_BUILD_BASELINE_LABEL
    const file = `e2e/${label}`
    const collected = inventory.filter(item => !group || item.group === group).map(({ name }) => ({ file, projectName: '', name, mode: 'run' }))
    const document = { ...original, invocationId: `github-issues-${index}`, runtimeTaskLabel: label, plannedFiles: [{ file, projectName: '' }], files: [{ file, projectName: '' }], collected, cases: collected.map(item => ({ ...item, state: 'passed' })) }
    const reference = `.tmp/run/vitest/github-issues-${index}.json`
    await localSave(path.join(value.root, reference), document)
    documents.push({ group, label, reference, document })
  }
  value.inventories.ci.splice(0, 1, ...documents.map(({ label }) => ({ label, definitionHash: 'd'.repeat(64), caseEvidence: true })))
  for (const name of Object.keys(value.inventories)) {
    const file = path.join(value.root, value.suitePath(name))
    const suite = JSON.parse(await readFile(file, 'utf8'))
    suite.executionTopology = executionTopology
    suite.execution.executionTopology = executionTopology
    if (name === 'ci') {
      suite.tasks.splice(0, 1, ...documents.map(({ label }) => ({ ...suite.tasks[0], label })))
      suite.execution.assignedTasks = suite.tasks.map(task => task.label)
      Object.assign(suite.summary, { taskCount: suite.tasks.length, plannedCount: suite.tasks.length, executedCount: suite.tasks.length, passedCount: suite.tasks.length })
    }
    await localSave(file, suite)
  }
  const stdoutFile = path.join(value.directory, 'tasks/runtime-full/stdout.log')
  const stdout = (await readFile(stdoutFile, 'utf8')).replace('[verification-local-case] index=.tmp/run/vitest/ci.json\n', documents.map(({ reference }) => `[verification-local-case] index=${reference}\n`).join(''))
  await writeFile(stdoutFile, stdout)
  const receiptFile = path.join(value.directory, 'tasks/runtime-full/receipt.json')
  const receipt = JSON.parse(await readFile(receiptFile, 'utf8'))
  receipt.stdout.digest = localDigest(stdout)
  await localSave(receiptFile, receipt)
  return { ...value, documents }
}

const collect = value => collectLocalEvidence(value.root, value.directory, value.plan, value.inventories, value.identity, value.start, value.end, value.raw)

it('normalizes all 99 actual case identities across 24 groups while preserving the physical raw evidence', async () => {
  const baseline = await githubIssuesFixture('optimized-v1')
  const candidate = await githubIssuesFixture('optimized-v2')
  const before = await collect(baseline)
  const after = await collect(candidate)
  expect(candidate.documents).toHaveLength(24)
  expect(after.scope.cases.filter(([file]) => file === `e2e/${GITHUB_ISSUES_BUILD_BASELINE_LABEL}`)).toHaveLength(99)
  expect(after.scope).toEqual(before.scope)
  expect(localDigest(after.scope)).toBe(localDigest(before.scope))
  expect(candidate.raw.vitest.filter(item => GITHUB_ISSUES_BUILD_TASK_LABELS.includes(item.value.runtimeTaskLabel))).toHaveLength(24)
})

it.each(['missing', 'duplicate', 'mode', 'state', 'note'])(
  'retains a v2 %s case difference in the complete normalized comparison scope',
  async (fault) => {
    const baseline = await githubIssuesFixture('optimized-v1')
    const candidate = await githubIssuesFixture('optimized-v2')
    const standard = candidate.documents.find(item => item.group === 'standard')
    const target = fault === 'duplicate' ? candidate.documents.find(item => item.group === 'sourcemap') : standard
    const { document } = target
    if (fault === 'missing') {
      document.collected.pop()
      document.cases.pop()
    }
    if (fault === 'duplicate') {
      document.collected[0].name = standard.document.collected[0].name
      document.cases[0].name = standard.document.cases[0].name
    }
    if (fault === 'mode') {
      document.collected[0].mode = 'skip'
      document.cases[0].mode = 'skip'
      document.cases[0].state = 'skipped'
    }
    if (fault === 'state') {
      document.cases[0].state = 'skipped'
    }
    if (fault === 'note') {
      document.cases[0].note = 'changed case annotation'
    }
    await localSave(path.join(candidate.root, target.reference), document)
    expect(localDigest((await collect(candidate)).scope)).not.toBe(localDigest((await collect(baseline)).scope))
  },
)
