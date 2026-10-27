import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import {
  GITHUB_ISSUES_BUILD_BASELINE_LABEL,
  GITHUB_ISSUES_BUILD_GROUPS,
  GITHUB_ISSUES_BUILD_TASK_LABELS,
  includesGithubIssuesBuildTask,
} from '../e2e/ci/githubIssuesBuild/groups'
import { createGithubIssuesBuildCaseContext } from '../e2e/ci/githubIssuesBuild/legacy/context'

const builds = vi.hoisted(() => ({ standard: vi.fn(async () => {}), sourcemap: vi.fn(async () => {}) }))
vi.mock('../e2e/ci/githubIssuesBuild/legacy/builders/standard', () => ({
  runBuild: builds.standard,
  runBuildWithSourcemap: builds.sourcemap,
}))

const root = path.resolve(import.meta.dirname, '..')
const buildRoot = path.join(root, 'e2e/ci/githubIssuesBuild')

async function readCaseInventory(directory: string) {
  const files = (await fs.readdir(directory)).filter(file => file.endsWith('.case.ts'))
  return await Promise.all(files.map(async (file) => {
    const filename = path.join(directory, file)
    const text = await fs.readFile(filename, 'utf8')
    const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true)
    const names: string[] = []
    let group: string | undefined
    let order: number | undefined
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        if (node.name.text === 'group' && ts.isStringLiteral(node.initializer)) {
          group = node.initializer.text
        }
        if (node.name.text === 'order' && ts.isNumericLiteral(node.initializer)) {
          order = Number(node.initializer.text)
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'it') {
        const name = node.arguments[0]
        if (!name || !ts.isStringLiteral(name)) {
          throw new Error(`${file} must retain a stable case title`)
        }
        names.push(name.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    return { file, group, order, names }
  }))
}

describe('GitHub issues build task inventory', () => {
  it('assigns every existing case exactly once and keeps the complete legacy order', async () => {
    const current = await readCaseInventory(path.join(buildRoot, 'cases'))
    const legacy = await readCaseInventory(path.join(buildRoot, 'legacy/cases'))
    const inventory = [...current, ...legacy]
    expect(inventory).toHaveLength(99)
    expect(inventory.flatMap(item => item.names)).toHaveLength(99)
    expect(new Set(inventory.flatMap(item => item.names)).size).toBe(99)
    expect(new Set(inventory.map(item => item.group))).toEqual(new Set(GITHUB_ISSUES_BUILD_GROUPS))
    expect(inventory.filter(item => item.group === 'standard')).toHaveLength(74)
    expect(inventory.filter(item => item.group === 'sourcemap')).toHaveLength(3)
    expect(legacy.map(item => item.order).sort((left, right) => left! - right!))
      .toEqual(Array.from({ length: 86 }, (_, index) => index + 1))
    for (const [index, group] of GITHUB_ISSUES_BUILD_GROUPS.entries()) {
      const entry = await fs.readFile(path.join(root, 'e2e', GITHUB_ISSUES_BUILD_TASK_LABELS[index]!), 'utf8')
      expect(entry).toContain(`registerGithubIssuesBuildCases(context, '${group}')`)
      expect(entry).toContain(`registerGithubIssuesBuildLegacyCases(context, '${group}')`)
    }
  })

  it('selects either the baseline or every independent task without changing unrelated tasks', () => {
    const labels = [GITHUB_ISSUES_BUILD_BASELINE_LABEL, ...GITHUB_ISSUES_BUILD_TASK_LABELS, 'ci/other.test.ts']
    for (const topology of ['legacy-v1', 'optimized-v1']) {
      expect(labels.filter(label => includesGithubIssuesBuildTask(label, topology)))
        .toEqual([GITHUB_ISSUES_BUILD_BASELINE_LABEL, 'ci/other.test.ts'])
    }
    expect(labels.filter(label => includesGithubIssuesBuildTask(label, 'optimized-v2')))
      .toEqual([...GITHUB_ISSUES_BUILD_TASK_LABELS, 'ci/other.test.ts'])
  })

  it('shares one real sourcemap build across the three readers while baseline keeps its original builders', async () => {
    builds.sourcemap.mockClear()
    const context = createGithubIssuesBuildCaseContext('sourcemap')
    await Promise.all(Array.from({ length: 3 }, () => context.runSourcemapBuild!()))
    expect(builds.sourcemap).toHaveBeenCalledTimes(1)
    expect(createGithubIssuesBuildCaseContext().runSourcemapBuild).toBeUndefined()
    expect(createGithubIssuesBuildCaseContext('standard').runStandardBuild).toBe(builds.standard)
    await createGithubIssuesBuildCaseContext('sourcemap').runSourcemapBuild!()
    expect(builds.sourcemap).toHaveBeenCalledTimes(2)
  })
})
