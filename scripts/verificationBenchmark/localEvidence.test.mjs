import { readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it } from 'vitest'
import { evaluateAcceptanceCase, summarizeAcceptanceCases } from '../../e2e/scripts/domAcceptanceReport/helpers.ts'
import { HMR_GUARD_SPECIAL_CASES, HMR_GUARD_STABLE_TESTS, HMR_GUARD_UTILITY_TESTS } from '../../e2e/scripts/hmr-guard-manifest.ts'
import { collectLocalEvidence, validateLocalFull } from './localEvidence.mjs'
import { localEvidenceFixture } from './localEvidenceFixture.mjs'
import { localDigest, localSave } from './localIo.mjs'
import { freezeLocalSuites } from './localRuntime.mjs'
import { validateLocalTurbo } from './localTurbo.mjs'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const value = await localEvidenceFixture()
  roots.push(value.root)
  return value
}

const collect = value => collectLocalEvidence(value.root, value.directory, value.plan, value.inventories, value.identity, value.start, value.end, value.raw)

async function mutate(value, file, change) {
  const absolute = path.join(value.root, file)
  const document = JSON.parse(await readFile(absolute, 'utf8'))
  change(document)
  await localSave(absolute, document)
}

it('accepts only the actual root marker and follows the complete child artifact tree including nested HMR', async () => {
  const value = await fixture()
  const stdout = await readFile(path.join(value.directory, 'tasks/runtime-full/stdout.log'), 'utf8')
  expect([...stdout.matchAll(/^\[e2e-suite-report\]/gmu)]).toHaveLength(1)
  const evidence = await collect(value)
  expect(evidence.ide).toMatchObject({ ideVersion: 'stable-fixture' })
  expect(value.raw.tasks).toHaveLength(4)
  expect(value.raw.vitest).toHaveLength(8)
  expect(value.raw.suites.map(document => document.value.suiteName).sort()).toEqual(['e2e:ci', 'e2e:full-regression', 'e2e:ide-full', 'e2e:ide-headless-full', 'e2e:web', 'hmr-guard:full'])
  expect(evidence.scope.leaves).toEqual(['library#build'])
})

it('freezes all full-regression children and HMR utility/stable/special tasks from the official manifests', async () => {
  const root = path.resolve(import.meta.dirname, '../..')
  const frozen = await freezeLocalSuites(root)
  expect(frozen['full-regression'].map(task => [task.label, task.childSuite])).toEqual([['e2e:ci', 'ci'], ['e2e:web', 'web'], ['e2e:ide:full', 'ide-full']])
  const children = frozen.ci.filter(task => task.childSuite).map(task => task.childSuite).sort()
  expect(children).toEqual(['hmr-guard:auto-import-vue-sfc', 'hmr-guard:auto-routes-hmr', 'hmr-guard:full', 'hmr-guard:shared-chunks-auto'])
  const label = file => path.relative(path.join(root, 'e2e'), file).replaceAll('\\', '/')
  expect(frozen['hmr-guard:full'].map(task => task.label)).toEqual([...HMR_GUARD_UTILITY_TESTS, ...HMR_GUARD_STABLE_TESTS].map(label))
  for (const [name, source] of [['auto-import-vue-sfc', HMR_GUARD_SPECIAL_CASES.autoImportVueSfc], ['auto-routes-hmr', HMR_GUARD_SPECIAL_CASES.autoRoutesHmr], ['shared-chunks-auto', HMR_GUARD_SPECIAL_CASES.sharedChunksAuto]]) {
    expect(frozen[`hmr-guard:${name}`].map(task => task.label)).toEqual([...HMR_GUARD_UTILITY_TESTS, source].map(label))
    expect(frozen[`hmr-guard:${name}`].every(task => task.caseEvidence && !task.childSuite)).toBe(true)
  }
})

it.each(['missing-hmr', 'missing-link', 'wrong-owner', 'other-run', 'outside-parent', 'cycle', 'duplicate-child', 'extra-child', 'escaped-path', 'missing-vitest'])(
  'rejects %s in the actual nested suite tree despite passing outer task results',
  async (fault) => {
    const value = await fixture()
    const ci = value.suitePath('ci')
    const hmr = value.suitePath('hmr-guard:full')
    if (fault === 'missing-hmr') {
      await rm(path.join(value.root, hmr))
    }
    if (fault === 'missing-link') {
      await mutate(value, ci, (document) => {
        document.tasks[1].artifacts = []
        document.summary.artifactCount--
      })
    }
    if (fault === 'wrong-owner') {
      await mutate(value, ci, document => document.tasks[1].artifacts[0].indexPath = value.suitePath('web'))
    }
    if (fault === 'other-run') {
      await mutate(value, hmr, document => document.runId = 'another-run')
    }
    if (fault === 'outside-parent') {
      await mutate(value, hmr, document => document.execution.startedAt = new Date(value.start + 2).toISOString())
    }
    if (fault === 'cycle') {
      await mutate(value, ci, document => document.tasks[1].artifacts[0].indexPath = value.suitePath('full-regression'))
    }
    if (fault === 'duplicate-child') {
      await mutate(value, ci, (document) => {
        document.tasks[1].artifacts.push(document.tasks[1].artifacts[0])
        document.summary.artifactCount++
      })
    }
    if (fault === 'extra-child') {
      await mutate(value, hmr, (document) => {
        document.tasks[0].artifacts.push({ kind: 'suite-report', indexPath: value.suitePath('web') })
        document.summary.artifactCount++
      })
    }
    if (fault === 'escaped-path') {
      await mutate(value, ci, document => document.tasks[1].artifacts[0].indexPath = `docs/reports/../${hmr}`)
    }
    if (fault === 'missing-vitest') {
      await mutate(value, '.tmp/run/vitest/hmr.json', document => document.runtimeTaskLabel = 'hmr-guard:full')
    }
    await expect(collect(value)).rejects.toThrow()
  },
)

it('rejects duplicate root markers rather than silently deduplicating them', async () => {
  const value = await fixture()
  const file = '.tmp/run/tasks/runtime-full/stdout.log'
  const stdout = await readFile(path.join(value.root, file), 'utf8')
  const changed = `${stdout + stdout.match(/^\[e2e-suite-report\].*$/mu)[0]}\n`
  await writeFile(path.join(value.root, file), changed)
  await mutate(value, '.tmp/run/tasks/runtime-full/receipt.json', document => document.stdout.digest = localDigest(changed))
  await expect(collect(value)).rejects.toThrow('root suite markers')
})

it('does not substitute a direct CI utility invocation for an unexecuted nested HMR invocation with the same label', async () => {
  const value = await fixture()
  const file = '.tmp/run/tasks/runtime-full/stdout.log'
  const stdout = await readFile(path.join(value.root, file), 'utf8')
  const changed = stdout.replace('[verification-local-case] index=.tmp/run/vitest/utility-hmr.json\n', '')
  await writeFile(path.join(value.root, file), changed)
  await rm(path.join(value.root, '.tmp/run/vitest/utility-hmr.json'))
  await mutate(value, '.tmp/run/tasks/runtime-full/receipt.json', document => document.stdout.digest = localDigest(changed))
  await expect(collect(value)).rejects.toThrow('invocation')
})

it('retains source-declared provider skips without reading runtime versions from absent DOM plans', async () => {
  const value = await fixture()
  const skipped = { file: 'e2e/ide/scene.test.ts', name: 'headless only' }
  value.inventories['ide-full'][0].cases.push(skipped)
  await mutate(value, 'docs/reports/dom-acceptance/fixture-run/ide.json', (document) => {
    document.cases.push(evaluateAcceptanceCase({ id: 'headless', ...skipped, state: 'skipped' }))
    document.summary = summarizeAcceptanceCases(document.cases)
  })
  await mutate(value, '.tmp/run/vitest/ide-full.json', (document) => {
    const item = { ...skipped, projectName: '', mode: 'skip' }
    document.collected.push(item)
    document.cases.push({ ...item, state: 'skipped' })
  })
  const evidence = await collect(value)
  expect(evidence.ide.ideVersion).toBe('stable-fixture')
  expect(evidence.scope.dom.some(entry => entry[2] === 'skipped' && entry[0].endsWith(':headless only'))).toBe(true)
})

it.each(['quick', 'review', 'partial', 'missing', 'duplicate', 'cached-wrapper'])(
  'rejects a %s top-level claim instead of counting it as complete full evidence',
  async (fault) => {
    const { plan, report } = await fixture()
    const changed = structuredClone(report)
    if (['quick', 'review'].includes(fault)) {
      changed.mode = fault
    }
    if (fault === 'partial') {
      changed.status = 'partial'
      changed.remaining = ['runtime acceptance']
    }
    if (fault === 'missing') {
      changed.results.pop()
    }
    if (fault === 'duplicate') {
      changed.results.push(changed.results[0])
    }
    if (fault === 'cached-wrapper') {
      changed.results[0].execution = 'not-executed'
    }
    expect(() => validateLocalFull(plan, changed, plan)).toThrow()
  },
)

it.each(['receipt', 'case', 'suite', 'dom', 'extra-vitest', 'stale', 'wrong-owner', 'changed-command', 'skip-child'])(
  'rejects missing or forged %s child evidence despite a passing wrapper',
  async (fault) => {
    const value = await fixture()
    const task = '.tmp/run/tasks/runtime-full/receipt.json'
    const cases = '.tmp/run/vitest/ide-full.json'
    const mutate = async (file, change) => {
      const absolute = path.join(value.root, file)
      const document = JSON.parse(await readFile(absolute, 'utf8'))
      change(document)
      await localSave(absolute, document)
    }
    if (fault === 'receipt') {
      await rm(path.join(value.root, task))
    }
    if (fault === 'case') {
      await mutate(cases, document => document.cases = [])
    }
    if (fault === 'suite') {
      await rm(path.join(value.root, 'docs/reports/2026-10-19-000000-web-suite-report/index.json'))
    }
    if (fault === 'dom') {
      await rm(path.join(value.root, 'docs/reports/dom-acceptance/fixture-run/ide.json'))
    }
    if (fault === 'extra-vitest') {
      await localSave(path.join(value.root, '.tmp/run/vitest/extra.json'), {})
    }
    if (fault === 'stale') {
      await mutate(cases, document => document.startedAt = '2000-01-01T00:00:00.000Z')
    }
    if (fault === 'wrong-owner') {
      await mutate(cases, document => document.taskInvocation = 'another')
    }
    if (fault === 'changed-command') {
      await mutate(task, document => document.effectiveArgs.push('--filter=only-one'))
    }
    if (fault === 'skip-child') {
      await mutate('docs/reports/2026-10-19-000000-web-suite-report/index.json', document => document.tasks[0].status = 'skipped')
    }
    await expect(collect(value)).rejects.toThrow()
  },
)

it('rejects stale hashes, missing leaves and wrapper success with an unexecuted real Turbo leaf', () => {
  const graph = { tasks: [{ taskId: 'library#types', hash: 'input', command: 'tsd' }] }
  const valid = { tasks: [{ taskId: 'library#types', hash: 'input', command: 'tsd', cache: { status: 'HIT' } }] }
  expect(validateLocalTurbo(graph, valid)).toEqual([['library#types', 'tsd', 'cached']])
  expect(() => validateLocalTurbo(graph, { tasks: [] })).toThrow()
  expect(() => validateLocalTurbo(graph, { tasks: [{ ...valid.tasks[0], hash: 'stale' }] })).toThrow()
  expect(() => validateLocalTurbo(graph, { tasks: [{ ...valid.tasks[0], cache: { status: 'MISS' } }] })).toThrow()
})

it.skipIf(process.platform === 'win32')('rejects a task log redirected through a symbolic link even when its digest matches', async () => {
  const value = await fixture()
  const log = path.join(value.directory, 'tasks/runtime-full/stdout.log')
  const target = path.join(value.directory, 'redirected.log')
  await writeFile(target, await readFile(log))
  await rm(log)
  await symlink(target, log)
  await expect(collect(value)).rejects.toThrow('symbolic links')
})

it('rejects final artifact drift after all task receipts were successfully recorded', async () => {
  const value = await fixture()
  await writeFile(path.join(value.root, 'packages/library/dist/index.js'), 'changed after verification')
  await expect(collect(value)).rejects.toThrow('checksum')
})
