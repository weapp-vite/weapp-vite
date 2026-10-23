import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsolatedTopologyTestEnvironment } from '../../../scripts/verification/topologyTestFixture.ts'
import { freeze, profile } from '../../../scripts/verificationE2E/fixtures'
import { createTaskCaseReader } from './inventory'
import { analyzeCaseSource, importedTestSources, readFactoryTitle } from './inventoryAnalyzer'
import { createInventorySourceReader, parseInventorySource } from './inventorySourceReader'
import { createPlannedTaskCaseReader } from './taskCases'

useIsolatedTopologyTestEnvironment()

describe('operation-scoped DOM source and case reuse', () => {
  let root: string
  const label = 'ide/aggregate.test.ts'

  function write(file: string, content: string) {
    fs.writeFileSync(path.join(root, `e2e/ide/${file}`), content)
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-case-reader-'))
    fs.mkdirSync(path.join(root, 'e2e/ide'), { recursive: true })
    write('aggregate.test.ts', 'import \'./child.test\'\nit(\'root\', ctx => createDomAcceptance(ctx, \'fixture\', [\'root-ready\']))')
    write('child.test.ts', 'it(\'leaf\', ctx => createDomAcceptance(ctx, \'fixture\', [\'leaf-ready\']))')
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('parses each unchanged source once across factory detection, case analysis, imports and repeated task reads', () => {
    const parse = vi.fn(parseInventorySource)
    const readSource = createInventorySourceReader(root, parse)
    const source = readSource(`e2e/${label}`)
    expect(readFactoryTitle(source, `e2e/${label}`, 'createSuite')).toBeUndefined()
    expect(analyzeCaseSource(source, `e2e/${label}`)).toHaveLength(1)
    expect(importedTestSources(source, `e2e/${label}`)).toEqual(['e2e/ide/child.test.ts'])
    const readCases = createTaskCaseReader(root, readSource)
    const first = readCases(label)
    expect(first.map(item => item.name)).toEqual(['root', 'leaf'])
    expect(readCases(label)).toEqual(first)
    expect(parse).toHaveBeenCalledTimes(2)
    first[1]!.plans.length = 0
    expect(readCases(label)[1]!.plans[0]?.checkpoints).toBe('[\'leaf-ready\']')
  })

  it('invalidates same-length byte edits despite unchanged mtime, including restored source', () => {
    const parse = vi.fn(parseInventorySource)
    const readCases = createTaskCaseReader(root, createInventorySourceReader(root, parse))
    const child = path.join(root, 'e2e/ide/child.test.ts')
    const original = fs.readFileSync(child, 'utf8')
    const { atime, mtime } = fs.statSync(child)
    expect(readCases(label).map(item => item.name)).toEqual(['root', 'leaf'])
    fs.writeFileSync(child, original.replace('\'leaf\'', '\'next\''))
    fs.utimesSync(child, atime, mtime)
    expect(readCases(label).map(item => item.name)).toEqual(['root', 'next'])
    expect(parse).toHaveBeenCalledTimes(3)
    fs.writeFileSync(child, original)
    fs.utimesSync(child, atime, mtime)
    expect(readCases(label).map(item => item.name)).toEqual(['root', 'leaf'])
    expect(parse).toHaveBeenCalledTimes(4)
  })

  it('keeps recursive imported cases once per task without sharing traversal state across roots', () => {
    write('aggregate.test.ts', 'import \'./child.test\'\nimport \'./sibling.test\'')
    write('sibling.test.ts', 'import \'./child.test\'\nit(\'sibling\', ctx => createDomAcceptance(ctx, \'fixture\', [\'sibling-ready\']))')
    write('child.test.ts', 'import \'./aggregate.test\'\nit(\'leaf\', ctx => createDomAcceptance(ctx, \'fixture\', [\'leaf-ready\']))')
    const parse = vi.fn(parseInventorySource)
    const readCases = createTaskCaseReader(root, createInventorySourceReader(root, parse))
    expect(readCases(label).map(item => item.name)).toEqual(['leaf', 'sibling'])
    expect(readCases('ide/sibling.test.ts').map(item => item.name)).toEqual(['sibling', 'leaf'])
    expect(readCases(label).map(item => item.name)).toEqual(['leaf', 'sibling'])
    expect(parse).toHaveBeenCalledTimes(3)
  })

  it('freezes complete independent provider plans while sharing raw cases and observing later imported edits', async () => {
    write('child.test.ts', [
      'import { describe, it } from \'vitest\'',
      'import { resolveRuntimeProviderName } from \'../utils/runtimeProvider\'',
      'const runtimeProvider = resolveRuntimeProviderName()',
      `describe(\`runtime \${runtimeProvider}\`, () => {`,
      '  it(\'shared\', ctx => createDomAcceptance(ctx, \'fixture\', [\'rendered\']))',
      '  it.runIf(runtimeProvider === \'headless\')(\'background\', ctx => createDomAcceptance(ctx, \'fixture\', [\'background-ready\']))',
      '})',
    ].join('\n'))
    const readCases = createPlannedTaskCaseReader(root)
    const task = { label, command: 'node', args: ['example.ts'] }
    const plans = await Promise.all((['headless', 'devtools'] as const).map(provider => freeze({
      suite: provider === 'headless' ? 'ide-hmr-headless' : 'ide-hmr',
      tasks: [task],
      shards: 1,
      profile: { ...profile, provider },
      readCases,
    })))
    expect(plans[0]!.commitSha).toBe(plans[1]!.commitSha)
    expect(plans[0]!.sourceDigest).toBe(plans[1]!.sourceDigest)
    expect(plans[0]!.planHash).not.toBe(plans[1]!.planHash)
    for (const [index, provider] of ['headless', 'devtools'].entries()) {
      const cases = plans[index]!.tasks[0]!.cases!
      expect(cases.map(item => item.name)).toEqual(['root', `runtime ${provider} > shared`, `runtime ${provider} > background`])
      expect(cases[2]!.providerScope).toMatchObject({ provider, scope: provider === 'headless' ? 'in-scope' : 'out-of-scope' })
    }
    fs.appendFileSync(path.join(root, 'e2e/ide/child.test.ts'), '\nit(\'new-child\', ctx => createDomAcceptance(ctx, \'fixture\', [\'new-ready\']))')
    expect((await readCases(task, 'devtools')).map(item => item.name)).toContain('new-child')
    expect(plans[1]!.tasks[0]!.cases).toHaveLength(3)
  })

  it('does not reuse another operation or project with the same relative path', () => {
    const parse = vi.fn(parseInventorySource)
    const readSource = createInventorySourceReader(root, parse)
    const source = readSource(`e2e/${label}`)
    expect(createInventorySourceReader(root, parse)(`e2e/${label}`)).not.toBe(source)
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-case-other-'))
    try {
      fs.mkdirSync(path.join(other, 'e2e/ide'), { recursive: true })
      fs.writeFileSync(path.join(other, `e2e/${label}`), 'it(\'other\', ctx => createDomAcceptance(ctx, \'other\', [\'ready\']))')
      expect(createTaskCaseReader(other)(label).map(item => item.name)).toEqual(['other'])
      expect(createTaskCaseReader(root, readSource)(label).map(item => item.name)).toEqual(['root', 'leaf'])
    }
    finally {
      fs.rmSync(other, { recursive: true, force: true })
    }
    expect(parse).toHaveBeenCalledTimes(3)
  })
})
