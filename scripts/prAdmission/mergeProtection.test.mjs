import { describe, expect, it, vi } from 'vitest'
import { liveFixture } from './fixtures.mjs'
import { checkLiveMergeProtection, validateMergeProtectionPolicy } from './mergeProtection.mjs'
import { exitCode } from './report.mjs'

function fixture() {
  const { policy: admission, protection } = liveFixture()
  const state = { policy: admission.mergeProtection, protection, rules: [], rulesets: {} }
  const gh = vi.fn(async (args) => {
    const endpoint = args.at(-1)
    let value
    if (endpoint.endsWith('/protection')) {
      value = state.protection
    }
    else if (endpoint.includes('/rules/branches/')) {
      const page = Number(new URL(`https://api.github.com/${endpoint}`).searchParams.get('page'))
      value = state.pages ? state.pages[page - 1] : state.rules
    }
    else {
      const id = /\/rulesets\/(\d+)\?/u.exec(endpoint)?.[1]
      value = state.rulesets[id]
    }
    if (value instanceof Error) {
      throw value
    }
    if (value === undefined) {
      throw new Error(`unexpected fixture endpoint: ${endpoint}`)
    }
    return JSON.stringify(value)
  })
  return Object.assign(state, { gh, options: { repository: 'example/project', root: '.', gh } })
}

function withRuleset(state) {
  state.protection = new Error('HTTP 404')
  const rule = {
    type: 'required_status_checks',
    ruleset_id: 17,
    ruleset_source: 'example/project',
    ruleset_source_type: 'Repository',
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: state.policy.requiredStatusCheck, integration_id: state.policy.integrationId }],
    },
  }
  const ruleset = {
    id: 17,
    source: rule.ruleset_source,
    source_type: rule.ruleset_source_type,
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    current_user_can_bypass: 'never',
    rules: [{ type: rule.type, parameters: structuredClone(rule.parameters) }],
  }
  state.rules = [rule]
  state.rulesets[17] = ruleset
  return { rule, ruleset }
}

const audit = state => checkLiveMergeProtection(state.policy, state.options)

describe('merge protection policy', () => {
  it('returns the approved policy without copying it', () => {
    const { policy } = fixture()
    expect(validateMergeProtectionPolicy(policy)).toBe(policy)
  })

  it.each([
    ['branch', 'other'],
    ['requiredStatusCheck', 'another check'],
    ['integrationId', -1],
    ['integrationId', '15368'],
    ['strict', false],
    ['enforceAdmins', false],
  ])('rejects weakened or malformed %s', (key, value) => {
    const { policy } = fixture()
    policy[key] = value
    expect(() => validateMergeProtectionPolicy(policy)).toThrow(TypeError)
  })

  it.each(['branch', 'requiredStatusCheck', 'integrationId', 'strict', 'enforceAdmins'])('requires %s', (key) => {
    const { policy } = fixture()
    delete policy[key]
    expect(() => validateMergeProtectionPolicy(policy)).toThrow(TypeError)
  })

  it.each([null, undefined, {}, []])('rejects missing policy: %j', (policy) => {
    expect(() => validateMergeProtectionPolicy(policy)).toThrow(TypeError)
  })
})

describe('read-only live merge protection audit', () => {
  it('accepts enforced strict classic protection for the exact check and Actions app with one explicit GET', async () => {
    const state = fixture()
    expect(exitCode(await audit(state))).toBe(0)
    expect(state.gh.mock.calls).toEqual([
      [['api', '--method', 'GET', 'repos/example/project/branches/main/protection'], '.'],
    ])
  })

  it('allows other required checks without weakening the required verdict source', async () => {
    const state = fixture()
    state.protection.required_status_checks.checks.unshift({ context: 'other', app_id: null })
    expect(exitCode(await audit(state))).toBe(0)
  })

  it.each([
    ['non-strict checks', (state) => { state.protection.required_status_checks.strict = false }],
    ['wrong context', (state) => { state.protection.required_status_checks.checks[0].context = 'other' }],
    ['wrong app', (state) => { state.protection.required_status_checks.checks[0].app_id = 42 }],
    ['any app', (state) => { state.protection.required_status_checks.checks[0].app_id = null }],
    ['wildcard app', (state) => { state.protection.required_status_checks.checks[0].app_id = -1 }],
    ['context metadata only', (state) => { state.protection.required_status_checks.checks = [] }],
    ['admin bypass', (state) => { state.protection.enforce_admins.enabled = false }],
    ['disabled protection', (state) => { state.protection.enabled = false }],
    ['disabled status enforcement', (state) => { state.protection.required_status_checks.enforcement_level = 'off' }],
    ['non-admin-only status enforcement', (state) => { state.protection.required_status_checks.enforcement_level = 'non_admins' }],
    ['no required checks', (state) => { state.protection.required_status_checks = null }],
    ['omitted optional required checks', (state) => { delete state.protection.required_status_checks }],
  ])('rejects classic %s as drift', async (_name, mutate) => {
    const state = fixture()
    mutate(state)
    const results = await audit(state)
    expect(exitCode(results)).toBe(1)
    expect(results.some(result => result.status === 'fail')).toBe(true)
    expect(state.gh.mock.calls).toHaveLength(2)
  })

  it('proves an unprotected branch only after successfully reading its effective rules', async () => {
    const state = fixture()
    state.protection = new Error('HTTP 404')
    expect(exitCode(await audit(state))).toBe(1)
    expect(state.gh.mock.calls.map(([args]) => args.at(-1))).toEqual([
      'repos/example/project/branches/main/protection',
      'repos/example/project/rules/branches/main?per_page=100&page=1',
    ])
  })

  it('accepts an explicit everyone enforcement level', async () => {
    const state = fixture()
    state.protection.required_status_checks.enforcement_level = 'everyone'
    expect(exitCode(await audit(state))).toBe(0)
  })

  it.each(['HTTP 401', 'HTTP 403', 'network unavailable', 'query timeout'])('does not replace %s with a passing alternative', async (message) => {
    const state = fixture()
    withRuleset(state)
    state.protection = new Error(message)
    const results = await audit(state)
    expect(exitCode(results)).toBe(2)
    expect(results).toContainEqual(expect.objectContaining({ status: 'error', actual: message }))
    expect(state.gh).toHaveBeenCalledTimes(1)
  })

  it('does not mistake an inaccessible repository for absent protection', async () => {
    const state = fixture()
    state.protection = new Error('HTTP 404')
    state.rules = new Error('HTTP 404')
    expect(exitCode(await audit(state))).toBe(2)
  })

  it.each([
    (state) => { state.protection = {} },
    (state) => { state.protection = [] },
    (state) => { delete state.protection.enforce_admins.enabled },
    (state) => { delete state.protection.required_status_checks.strict },
    (state) => { delete state.protection.required_status_checks.checks },
    (state) => { delete state.protection.required_status_checks.checks[0].app_id },
    (state) => { state.protection.required_status_checks.checks[0].app_id = '15368' },
    (state) => { state.protection.required_status_checks.enforcement_level = 'unknown' },
  ])('marks malformed classic fields incomplete instead of passing', async (mutate) => {
    const state = fixture()
    mutate(state)
    expect(exitCode(await audit(state))).toBe(2)
    expect(state.gh).toHaveBeenCalledTimes(1)
  })

  it('reports malformed JSON without reading alternate configuration', async () => {
    const state = fixture()
    state.gh.mockResolvedValueOnce('not JSON')
    expect(await audit(state)).toEqual([
      expect.objectContaining({ status: 'error', actual: 'GitHub API 响应不是有效 JSON' }),
    ])
    expect(state.gh).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid policy and repository before contacting GitHub', async () => {
    const state = fixture()
    state.policy.strict = false
    expect(exitCode(await audit(state))).toBe(2)
    expect(exitCode(await checkLiveMergeProtection(fixture().policy, { ...state.options, repository: 'invalid' }))).toBe(2)
    expect(state.gh).not.toHaveBeenCalled()
  })

  it('accepts an effective active ruleset only after proving that no actor can bypass it', async () => {
    const state = fixture()
    withRuleset(state)
    expect(exitCode(await audit(state))).toBe(0)
    expect(state.gh.mock.calls.map(([args]) => args)).toEqual([
      ['api', '--method', 'GET', 'repos/example/project/branches/main/protection'],
      ['api', '--method', 'GET', 'repos/example/project/rules/branches/main?per_page=100&page=1'],
      ['api', '--method', 'GET', 'repos/example/project/rulesets/17?includes_parents=true'],
    ])
  })

  it('accepts independently enforced rules even when classic protection is weaker', async () => {
    const state = fixture()
    const protection = state.protection
    withRuleset(state)
    state.protection = protection
    protection.enforce_admins.enabled = false
    expect(exitCode(await audit(state))).toBe(0)
  })

  it.each([
    ['non-strict rule', (rule) => { rule.parameters.strict_required_status_checks_policy = false }],
    ['wrong context', (rule) => { rule.parameters.required_status_checks[0].context = 'other' }],
    ['wrong app', (rule) => { rule.parameters.required_status_checks[0].integration_id = 42 }],
    ['unspecified app', (rule) => { delete rule.parameters.required_status_checks[0].integration_id }],
    ['null app', (rule) => { rule.parameters.required_status_checks[0].integration_id = null }],
  ])('rejects effective %s', async (_name, mutate) => {
    const state = fixture()
    const { rule } = withRuleset(state)
    mutate(rule)
    expect(exitCode(await audit(state))).toBe(1)
  })

  it.each(['disabled', 'evaluate'])('rejects %s metadata even if an effective rule was previously returned', async (enforcement) => {
    const state = fixture()
    const { ruleset } = withRuleset(state)
    ruleset.enforcement = enforcement
    expect(exitCode(await audit(state))).toBe(1)
  })

  it('does not treat a declared rule outside the effective branch rules as enforcement', async () => {
    const state = fixture()
    withRuleset(state)
    state.rules = []
    expect(exitCode(await audit(state))).toBe(1)
    expect(state.gh).toHaveBeenCalledTimes(2)
  })

  it.each([
    { actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' },
    { actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'pull_request' },
    { actor_type: 'OrganizationAdmin', actor_id: null, bypass_mode: 'always' },
    { actor_type: 'Integration', actor_id: 15368, bypass_mode: 'always' },
    { actor_type: 'Team', actor_id: 3, bypass_mode: 'exempt' },
  ])('rejects bypass actor %j', async (actor) => {
    const state = fixture()
    const { ruleset } = withRuleset(state)
    ruleset.bypass_actors = [actor]
    expect(exitCode(await audit(state))).toBe(1)
  })

  it.each([
    (ruleset) => { ruleset.current_user_can_bypass = 'always' },
    (ruleset) => { ruleset.rules = [] },
    (ruleset) => { ruleset.rules[0].parameters.strict_required_status_checks_policy = false },
    (ruleset) => { ruleset.rules[0].parameters.required_status_checks[0].integration_id = 42 },
  ])('rejects contradictory or changed ruleset enforcement', async (mutate) => {
    const state = fixture()
    const { ruleset } = withRuleset(state)
    mutate(ruleset)
    expect(exitCode(await audit(state))).toBe(1)
  })

  it.each([
    ({ ruleset }) => { delete ruleset.bypass_actors },
    ({ ruleset }) => { ruleset.bypass_actors = null },
    ({ ruleset }) => { ruleset.bypass_actors = [null] },
    ({ ruleset }) => { ruleset.source = 'different/project' },
    ({ ruleset }) => { ruleset.id = 18 },
    ({ ruleset }) => { ruleset.enforcement = 'unknown' },
    ({ ruleset }) => { delete ruleset.rules },
    ({ rule }) => { delete rule.ruleset_id },
    ({ rule }) => { rule.parameters.required_status_checks[0].integration_id = '15368' },
    ({ rule }) => { delete rule.parameters.strict_required_status_checks_policy },
  ])('marks hidden, mismatched or malformed ruleset facts incomplete', async (mutate) => {
    const state = fixture()
    mutate(withRuleset(state))
    expect(exitCode(await audit(state))).toBe(2)
  })

  it.each(['HTTP 403', 'HTTP 404', 'network unavailable'])('preserves incomplete ruleset reads: %s', async (message) => {
    const state = fixture()
    withRuleset(state)
    state.rulesets[17] = new Error(message)
    expect(exitCode(await audit(state))).toBe(2)
  })

  it('does not mistake a malformed effective-rules response for no rules', async () => {
    const state = fixture()
    withRuleset(state)
    state.rules = { rules: [] }
    expect(exitCode(await audit(state))).toBe(2)
  })

  it('checks every effective status rule while reading each ruleset only once', async () => {
    const state = fixture()
    const { rule } = withRuleset(state)
    const weaker = structuredClone(rule)
    weaker.parameters.strict_required_status_checks_policy = false
    state.rules.unshift(weaker)
    expect(exitCode(await audit(state))).toBe(0)
    expect(state.gh).toHaveBeenCalledTimes(3)
  })

  it('accepts a separate non-bypassable ruleset even when another permits bypass', async () => {
    const state = fixture()
    const { rule, ruleset } = withRuleset(state)
    const enforced = structuredClone(ruleset)
    enforced.id = 18
    state.rulesets[18] = enforced
    state.rules.push({ ...rule, ruleset_id: 18 })
    ruleset.bypass_actors = [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }]
    expect(exitCode(await audit(state))).toBe(0)
    expect(state.gh).toHaveBeenCalledTimes(4)
  })

  it('supports active inherited rules through the repository ruleset endpoint', async () => {
    const state = fixture()
    const { rule, ruleset } = withRuleset(state)
    rule.ruleset_source_type = 'Organization'
    ruleset.source_type = 'Organization'
    rule.ruleset_source = 'example'
    ruleset.source = 'example'
    expect(exitCode(await audit(state))).toBe(0)
  })

  it('reads every effective-rules page before accepting a required check', async () => {
    const state = fixture()
    withRuleset(state)
    state.pages = [Array.from({ length: 100 }, () => ({ type: 'deletion' })), state.rules]
    expect(exitCode(await audit(state))).toBe(0)
    expect(state.gh.mock.calls[2][0].at(-1)).toBe('repos/example/project/rules/branches/main?per_page=100&page=2')
  })
})
