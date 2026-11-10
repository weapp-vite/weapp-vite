import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import { assertNativePrVerdict } from '../.github/scripts/native-pr-verdict.mjs'

const profiles = JSON.parse(readFileSync(new URL('../.github/pr-checks.json', import.meta.url), 'utf8'))
const names = Object.keys(profiles)
const sha = value => value.repeat(40)
const execute = promisify(execFile)
const script = fileURLToPath(new URL('../.github/scripts/native-pr-verdict.mjs', import.meta.url))

function fixture(selected = ['ci', 'ci-performance'], documentationOnly = false) {
  const context = {
    schemaVersion: 1,
    event: 'pull_request',
    repository: 'example/project',
    runId: '123',
    runAttempt: 2,
    isPr: true,
    shouldRun: true,
    prNumber: 42,
    headSha: sha('a'),
    baseSha: sha('b'),
    driverSha: sha('c'),
    checkoutSha: sha('c'),
    checkoutMode: 'merge',
    headRef: 'feature',
    baseRef: 'main',
    headRepository: 'example/fork',
    selections: Object.fromEntries(names.map(name => [name, selected.includes(name)])),
    documentationOnly,
    documentationPaths: documentationOnly ? ['README.md'] : [],
    documentationChecks: [],
  }
  const needs = {
    approval: { result: 'success' },
    plan: { result: 'success' },
    ...Object.fromEntries(names.map(name => [name, { result: context.selections[name] ? 'success' : 'skipped' }])),
    documentation: { result: documentationOnly ? 'success' : 'skipped' },
  }
  return { context, needs }
}

function assertFixture({ context, needs }) {
  return assertNativePrVerdict(context, needs, profiles)
}

describe('native PR frozen snapshot verdict', () => {
  it('accepts a complete mix of selected successes and deliberately skipped profiles', () => {
    const state = fixture()
    expect(assertFixture(state)).toBe(state.context)
    expect(state.needs.ci.result).toBe('success')
    expect(state.needs['ci-policy'].result).toBe('skipped')
  })

  it('accepts every selected profile and the real documentation-only route', () => {
    expect(assertFixture(fixture(names))).toBeDefined()
    const documentation = fixture([], true)
    expect(assertFixture(documentation)).toBe(documentation.context)
    expect(documentation.needs.documentation.result).toBe('success')
    expect(names.every(name => documentation.needs[name].result === 'skipped')).toBe(true)
  })

  it('does not re-resolve mutable refs for ordinary or refresh snapshots', () => {
    const request = vi.fn(() => {
      throw new Error('Verdict must not read the network')
    })
    vi.stubGlobal('fetch', request)
    try {
      expect(assertFixture(fixture())).toBeDefined()
      const refresh = fixture()
      Object.assign(refresh.context, { event: 'native_refresh', driverSha: sha('d'), controlRef: 'main', headRepository: 'example/project', headRepositoryId: 1, baseRepositoryId: 1 })
      expect(assertFixture(refresh)).toBe(refresh.context)
      expect(request).not.toHaveBeenCalled()
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it.each(['approval', 'plan', 'ci', 'ci-performance'])('requires selected job %s to succeed', (name) => {
    for (const result of ['failure', 'cancelled', 'skipped', 'neutral', 'pending', '', null, undefined, true, 1]) {
      const state = fixture()
      state.needs[name].result = result
      expect(() => assertFixture(state)).toThrow(`Native PR job ${name} must be success`)
    }
  })

  it.each(names.filter(name => !['ci', 'ci-performance'].includes(name)))('requires nonselected job %s to be exactly skipped', (name) => {
    for (const result of ['success', 'failure', 'cancelled', 'neutral', null, undefined]) {
      const state = fixture()
      state.needs[name].result = result
      expect(() => assertFixture(state)).toThrow(`Native PR job ${name} must be skipped`)
    }
  })

  it.each([false, true])('enforces the exact documentation result for documentationOnly=%s', (documentationOnly) => {
    for (const result of documentationOnly ? ['skipped', 'failure', 'cancelled', 'neutral', null] : ['success', 'failure', 'cancelled', 'neutral', null]) {
      const state = fixture(documentationOnly ? [] : ['ci'], documentationOnly)
      state.needs.documentation.result = result
      expect(() => assertFixture(state)).toThrow('Native PR job documentation must be')
    }
  })

  it('rejects all-skipped false greens and mixed documentation/product routing', () => {
    expect(() => assertFixture(fixture([]))).toThrow('must select profiles or documentation only')
    expect(() => assertFixture(fixture(['ci'], true))).toThrow('must select profiles or documentation only')
  })

  it.each(['approval', 'plan', ...names, 'documentation'])('rejects the missing dependency %s', (name) => {
    const state = fixture()
    delete state.needs[name]
    expect(() => assertFixture(state)).toThrow('Incomplete or unknown native PR job results')
  })

  it.each(['verdict', 'unknown-profile'])('rejects extra dependency %s', (name) => {
    const state = fixture()
    state.needs[name] = { result: 'success' }
    expect(() => assertFixture(state)).toThrow('Incomplete or unknown native PR job results')
  })

  it.each([null, [], 'success', {}, { conclusion: 'success' }].map(value => [value]))('rejects an invalid job record %j', (result) => {
    const state = fixture()
    state.needs.ci = result
    expect(() => assertFixture(state)).toThrow()
  })

  it.each([null, [], 'success'].map(value => [value]))('rejects an invalid needs map %j', (needs) => {
    expect(() => assertNativePrVerdict(fixture().context, needs, profiles)).toThrow('Invalid native PR job results')
  })

  it.each(names)('requires an explicit frozen boolean selection for %s', (name) => {
    const missing = fixture()
    delete missing.context.selections[name]
    expect(() => assertFixture(missing)).toThrow('Incomplete or unknown frozen profile selections')
    for (const selected of ['true', 'false', 1, null, undefined]) {
      const state = fixture()
      state.context.selections[name] = selected
      expect(() => assertFixture(state)).toThrow('Invalid frozen profile selection')
    }
  })

  it('rejects unknown selections rather than ignoring unaccounted frozen work', () => {
    const state = fixture()
    state.context.selections.unknown = false
    expect(() => assertFixture(state)).toThrow('Incomplete or unknown frozen profile selections')
  })

  it.each([null, [], 'true'].map(value => [value]))('rejects invalid frozen selections %j', (selections) => {
    const state = fixture()
    state.context.selections = selections
    expect(() => assertFixture(state)).toThrow()
  })

  it.each([undefined, null, 'false', 0])('rejects an invalid documentation selection %j', (documentationOnly) => {
    const state = fixture()
    state.context.documentationOnly = documentationOnly
    expect(() => assertFixture(state)).toThrow('Invalid frozen documentation selection')
  })

  it.each([{ event: 'workflow_dispatch' }, { isPr: false }, { checkoutSha: sha('d') }, { baseSha: 'main' }, { runAttempt: 0 }])('uses the existing native context shape validation for %j', (change) => {
    const state = fixture()
    Object.assign(state.context, change)
    expect(() => assertFixture(state)).toThrow('Untrusted native PR context')
  })

  it.each([null, [], {}, { plan: {} }, { documentation: {} }, { verdict: {} }, { approval: {} }].map(value => [value]))('rejects invalid profile declarations %j', (value) => {
    const state = fixture()
    expect(() => assertNativePrVerdict(state.context, state.needs, value)).toThrow('Invalid native PR profile')
  })
})

describe('native PR verdict CLI', () => {
  it.each([false, true])('runs the real entry for documentationOnly=%s', async (documentationOnly) => {
    const { context, needs } = fixture(documentationOnly ? [] : ['ci'], documentationOnly)
    const result = await execute(process.execPath, [script], { env: { ...process.env, PR_FROZEN_CONTEXT: JSON.stringify(context), PR_NEEDS_JSON: JSON.stringify(needs) } })
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain(`PR snapshot checks passed for frozen merge ${context.checkoutSha}`)
  })

  it('exits nonzero without a success message for failed selected work', async () => {
    const { context, needs } = fixture()
    needs.ci.result = 'failure'
    await expect(execute(process.execPath, [script], { env: { ...process.env, PR_FROZEN_CONTEXT: JSON.stringify(context), PR_NEEDS_JSON: JSON.stringify(needs) } })).rejects.toMatchObject({ code: 1, stdout: '', stderr: expect.stringContaining('Native PR job ci must be success') })
  })

  it.each(['PR_FROZEN_CONTEXT', 'PR_NEEDS_JSON'])('fails closed for absent or malformed %s', async (name) => {
    const { context, needs } = fixture()
    for (const value of [undefined, '{']) {
      const env = { ...process.env, PR_FROZEN_CONTEXT: JSON.stringify(context), PR_NEEDS_JSON: JSON.stringify(needs), [name]: value }
      await expect(execute(process.execPath, [script], { env })).rejects.toMatchObject({ code: 1, stdout: '' })
    }
  })
})
