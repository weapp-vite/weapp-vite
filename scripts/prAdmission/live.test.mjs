// eslint-disable-next-line e18e/ban-dependencies -- 核验正式 CLI 启动器的参数数组、超时与错误边界。
import { execa } from 'execa'
import { describe, expect, it, vi } from 'vitest'
import { liveFixture } from './fixtures.mjs'
import { checkLiveAdmission, runGh } from './live.mjs'
import { exitCode } from './report.mjs'

vi.mock('execa', () => ({ execa: vi.fn() }))

function fixture() {
  const state = liveFixture()
  const gh = vi.fn(async (args) => {
    if (args[0] === 'repo') {
      return 'example/project\n'
    }
    return JSON.stringify(args.at(-1).includes('/environments/') ? state.environment : state.fork)
  })
  return { ...state, gh, options: { root: '.', gh } }
}

describe('read-only live approval audit', () => {
  it('discovers the current repository and uses only explicit GET API calls', async () => {
    const { policy, options, gh } = fixture()
    expect(exitCode(await checkLiveAdmission(policy, options))).toBe(0)
    expect(gh.mock.calls.map(([args]) => args)).toEqual([
      ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
      ['api', '--method', 'GET', `repos/example/project/environments/${policy.environment}`],
      ['api', '--method', 'GET', 'repos/example/project/actions/permissions/fork-pr-contributor-approval'],
    ])
  })

  it('uses --repo without consulting the current repository', async () => {
    const { policy, options, gh } = fixture()
    expect(exitCode(await checkLiveAdmission(policy, { ...options, repository: 'chosen/project' }))).toBe(0)
    expect(gh.mock.calls).toHaveLength(2)
    expect(gh.mock.calls.every(([args]) => args.at(-1).startsWith('repos/chosen/project/'))).toBe(true)
  })

  it('compares reviewer sets independently of API ordering', async () => {
    const { policy, environment, options } = fixture()
    environment.protection_rules[0].reviewers.reverse()
    expect(exitCode(await checkLiveAdmission(policy, options))).toBe(0)
  })

  it.each([
    ['missing reviewer', (state) => { state.environment.protection_rules[0].reviewers.pop() }, '指定审批人'],
    ['missing protection', (state) => { state.environment.protection_rules = [] }, '指定审批保护数量'],
    ['admin bypass', (state) => { state.environment.can_admins_bypass = true }, '管理员可绕过'],
    ['self approval disabled', (state) => { state.environment.protection_rules[0].prevent_self_review = true }, '禁止自行批准'],
    ['wait timer', (state) => { state.environment.protection_rules.push({ type: 'wait_timer', wait_timer: 10 }) }, '等待计时器（分钟）'],
    ['branch restrictions', (state) => { state.environment.deployment_branch_policy = { protected_branches: true, custom_branch_policies: false } }, 'Environment 分支限制'],
    ['fork policy', (state) => { state.fork.approval_policy = 'first_time_contributors' }, 'fork 审核策略'],
  ])('reports %s as drift, not an incomplete check', async (_name, mutate, checkName) => {
    const state = fixture()
    mutate(state)
    const results = await checkLiveAdmission(state.policy, state.options)
    expect(exitCode(results)).toBe(1)
    expect(results).toContainEqual(expect.objectContaining({ name: checkName, status: 'fail' }))
  })

  it.each([
    state => delete state.environment.can_admins_bypass,
    state => delete state.environment.protection_rules[0].prevent_self_review,
    state => delete state.environment.deployment_branch_policy,
    state => delete state.fork.approval_policy,
  ])('does not silently default missing API fields to passing values', async (mutate) => {
    const state = fixture()
    mutate(state)
    expect(exitCode(await checkLiveAdmission(state.policy, state.options))).toBe(2)
  })

  it('reports authentication failure without attempting other API calls', async () => {
    const { policy, options, gh } = fixture()
    gh.mockRejectedValue(new Error('authentication required'))
    const results = await checkLiveAdmission(policy, options)
    expect(exitCode(results)).toBe(2)
    expect(results).toEqual([expect.objectContaining({ name: '识别线上仓库', status: 'error', actual: 'authentication required' })])
    expect(gh).toHaveBeenCalledTimes(1)
  })

  it('keeps the fork result when Environment permissions are missing', async () => {
    const { policy, options, gh } = fixture()
    gh.mockRejectedValueOnce(new Error('HTTP 403'))
    const results = await checkLiveAdmission(policy, { ...options, repository: 'example/project' })
    expect(exitCode(results)).toBe(2)
    expect(results).toEqual([
      expect.objectContaining({ status: 'error', actual: 'HTTP 403' }),
      expect.objectContaining({ name: 'fork 审核策略', status: 'pass' }),
    ])
  })

  it('marks invalid JSON as incomplete and still checks the other endpoint', async () => {
    const { policy, options, gh } = fixture()
    gh.mockResolvedValueOnce('not JSON')
    const results = await checkLiveAdmission(policy, { ...options, repository: 'example/project' })
    expect(exitCode(results)).toBe(2)
    expect(results[0]).toMatchObject({ status: 'error', actual: 'GitHub API 响应不是有效 JSON' })
    expect(results[1].status).toBe('pass')
  })

  it('passes an argument array and bounded non-interactive options to the executable', async () => {
    const args = ['api', '--method', 'GET', 'repos/example/project/environments/pr-ci-approval']
    vi.mocked(execa).mockResolvedValueOnce({ stdout: '{}' })
    expect(await runGh(args, '.')).toBe('{}')
    expect(execa).toHaveBeenCalledWith('gh', args, { cwd: '.', shell: false, timeout: 30_000, env: { GH_PROMPT_DISABLED: '1' } })
  })

  it('does not print raw process output when gh fails', async () => {
    vi.mocked(execa).mockRejectedValueOnce(new Error('raw credential-bearing process output'))
    await expect(runGh(['api', '--method', 'GET', 'repos/example/project'], '.')).rejects.toThrow(/^GitHub CLI 查询失败/u)
  })
})
