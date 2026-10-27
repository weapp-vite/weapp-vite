/* eslint-disable no-template-curly-in-string -- fixture 需要保留 GitHub Actions 表达式字面量。 */
import { describe, expect, it } from 'vitest'
import { localFixture } from './fixtures.mjs'
import { checkLocalAdmission } from './local.mjs'
import { exitCode } from './report.mjs'

function failures(change) {
  const state = localFixture()
  change(state)
  const results = checkLocalAdmission(state)
  expect(exitCode(results)).toBe(1)
  return results.filter(row => row.status === 'fail')
}

describe('offline PR admission contract', () => {
  it('accepts the repository workflows and the centralized approval policy', () => {
    const results = checkLocalAdmission(localFixture())
    expect(results.length).toBeGreaterThan(50)
    expect(results.filter(row => row.status !== 'pass')).toEqual([])
  })

  it.each(['pull_request', ['pull_request'], { pull_request: null }])('detects another PR entry using on: %j', (on) => {
    expect(failures(({ workflows }) => {
      workflows['unexpected.yaml'] = { on, jobs: { build: { 'runs-on': 'ubuntu-latest' } } }
    })).toContainEqual(expect.objectContaining({ name: '唯一 PR 入口', actual: ['ci-pr.yml', 'unexpected.yaml'] }))
  })

  it.each(['pull_request_target', 'pull_request_review', 'pull_request_review_comment'])('detects an independent %s entry', (event) => {
    expect(failures(({ workflows }) => {
      workflows['unexpected.yml'] = { on: event }
    }).some(row => row.name.includes(event) || row.name === '唯一关闭事件入口')).toBe(true)
  })

  it('does not accept an unrelated Environment name', () => {
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].jobs.approval.environment = 'unprotected'
    })).toContainEqual(expect.objectContaining({ name: '审批 Environment' }))
  })

  it.each(['environment', 'checkout', 'permissions', 'command', 'plan'])('rejects weakened automatic changeset %s boundaries', (field) => {
    const checks = failures(({ workflows }) => {
      const job = workflows['release-intent-auto.yml'].jobs.apply
      if (field === 'environment') {
        job.environment = 'unprotected'
      }
      if (field === 'checkout') {
        job.steps.push({ uses: 'actions/checkout@head', with: { ref: '${{ github.event.pull_request.head.sha }}' } })
      }
      if (field === 'permissions') {
        job.permissions['id-token'] = 'write'
      }
      if (field === 'command') {
        job.steps.at(-1).run += '\npnpm exec repo release snapshot --publish'
      }
      if (field === 'plan') {
        delete workflows['release-intent-auto.yml'].jobs.plan.environment
      }
    })
    expect(checks.some(row => row.name.startsWith('自动 changeset'))).toBe(true)
  })

  it.each(['approval', 'plan', 'ci', 'documentation'])('detects a broken dependency boundary at %s', (job) => {
    expect(failures(({ workflows }) => {
      const target = workflows['ci-pr.yml'].jobs[job]
      if (job === 'approval') {
        target.needs = 'other'
      }
      else {
        delete target.needs
      }
    })).toContainEqual(expect.objectContaining({ name: job === 'approval' ? '审批为唯一根任务' : job === 'plan' ? '冻结目标等待审批' : `${job} 等待冻结目标` }))
  })

  it('rejects an independent root job even if it is not registered as a validation', () => {
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].jobs.extra = { 'runs-on': 'ubuntu-latest', 'steps': [{ run: 'echo build' }] }
    })).toContainEqual(expect.objectContaining({ name: '单一审批后的任务清单' }))
  })

  it.each(['approval', 'plan', 'ci', 'documentation'])('rejects status functions that can run %s after a skipped or cancelled dependency', (job) => {
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].jobs[job].if = '!cancelled()'
    })).toContainEqual(expect.objectContaining({ name: `${job} 不绕过跳过或取消的依赖` }))
  })

  it.each([
    ['selection', 'documentation 使用冻结的文档选择'],
    ['checkout', 'documentation 使用冻结的 merge checkout'],
    ['identity', 'documentation 校验冻结身份及拓扑'],
    ['permissions', 'documentation 仅使用只读权限'],
    ['extra-step', 'documentation 验证步骤及顺序'],
    ['skip-identity', 'documentation identity 不跳过必需验证'],
    ['setup-delete', 'documentation setup 覆盖删除生成目标'],
    ['install-delete', 'documentation install 覆盖删除生成目标'],
    ['lifecycle', 'documentation 冻结安装不执行生命周期'],
    ['paths', 'documentation 仅传入冻结的文档和生成契约'],
    ['contracts', 'documentation 仅传入冻结的文档和生成契约'],
    ['continue-on-error', 'documentation 不放过验证失败'],
  ])('rejects weakened native documentation %s boundaries', (field, expected) => {
    const checks = failures(({ workflows }) => {
      const job = workflows['ci-pr.yml'].jobs.documentation
      const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'))
      const identity = job.steps.find(step => step.uses === './.github/actions/verify-frozen-job-context')
      const setup = job.steps.find(step => step.uses === './.github/actions/setup-node-pnpm')
      const install = job.steps.find(step => step.uses === './.github/actions/install-workspace-deps')
      const verify = job.steps.at(-1)
      if (field === 'selection') {
        job.if = 'true'
      }
      if (field === 'checkout') {
        checkout.with.ref = '${{ github.event.pull_request.head.sha }}'
      }
      if (field === 'identity') {
        identity.with.profile = 'ci'
      }
      if (field === 'permissions') {
        job.permissions = { contents: 'write' }
      }
      if (field === 'extra-step') {
        job.steps.push({ run: 'pnpm build:pkgs' })
      }
      if (field === 'skip-identity') {
        identity.if = 'false'
      }
      if (field === 'setup-delete' || field === 'install-delete') {
        const step = field === 'setup-delete' ? setup : install
        step.if = 'fromJSON(needs.plan.outputs.pr_context).documentationPaths[0] != null'
      }
      if (field === 'lifecycle') {
        install.with['ignore-scripts'] = 'false'
      }
      if (field === 'paths') {
        verify.env.PR_DOCUMENTATION_PATHS = '["README.md"]'
      }
      if (field === 'contracts') {
        delete verify.env.PR_DOCUMENTATION_CHECKS
      }
      if (field === 'continue-on-error') {
        verify['continue-on-error'] = true
      }
    })
    expect(checks).toContainEqual(expect.objectContaining({ name: expected }))
  })

  it('keeps closing a PR as a cancellation event with no independent work', () => {
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].on.pull_request_target.types.push('opened')
      workflows['ci-pr.yml'].jobs.approval.if = 'true'
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '原生触发事件' }),
      expect.objectContaining({ name: '关闭事件跳过审批' }),
    ]))
  })

  it('rejects an explicit success condition that can still bypass a skipped approval', () => {
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].jobs.plan.if = 'success() || true'
    })).toContainEqual(expect.objectContaining({ name: '冻结目标不覆盖默认依赖条件' }))
  })

  it.each(['global-ci', 'pr-ci-${{ github.sha }}'])('rejects a concurrency group that does not isolate the PR: %s', (group) => {
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].concurrency.group = group
    })).toContainEqual(expect.objectContaining({ name: 'PR 并发隔离与旧运行取消' }))
  })

  it('requires new revisions to cancel older runs', () => {
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].concurrency['cancel-in-progress'] = false
    })).toContainEqual(expect.objectContaining({ name: 'PR 并发隔离与旧运行取消' }))
  })

  it('rejects full performance collection inside the approval graph', () => {
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].jobs.ci.uses = './.github/workflows/nightly-performance.yml'
    })).toContainEqual(expect.objectContaining({ name: '完整性能验收不纳入 PR 审批' }))
  })

  it.each(['failure', 'cancelled'])('detects a native report guard changed to %s', (conclusion) => {
    expect(failures(({ workflows }) => {
      const job = workflows['ci-performance-comment.yml'].jobs['native-pr-report']
      job.if = job.if.replace('conclusion == \'success\'', `conclusion == '${conclusion}'`)
    })).toContainEqual(expect.objectContaining({ name: 'native-pr-report 报告准入条件' }))
  })

  it('detects a new report runner and an additional workflow_run listener', () => {
    expect(failures(({ workflows }) => {
      workflows['ci-performance-comment.yml'].jobs.extra = { 'runs-on': 'ubuntu-latest' }
      workflows['extra-report.yml'] = { on: { workflow_run: { workflows: ['PR CI'], types: ['requested'] } } }
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '原生报告任务清单' }),
      expect.objectContaining({ name: '原生完成报告入口' }),
    ]))
  })

  it('checks guards on legacy report jobs as well as the native job', () => {
    expect(failures(({ workflows }) => {
      delete workflows['ci-performance-comment.yml'].jobs['report-v2'].if
    })).toContainEqual(expect.objectContaining({ name: 'report-v2 报告准入条件' }))
  })

  it('accepts whitespace and expression wrappers without evaluating YAML code', () => {
    const state = localFixture()
    state.workflows['ci-pr.yml'].jobs.approval.if = '${{  github.event_name\n == \'pull_request\' }}'
    expect(exitCode(checkLocalAdmission(state))).toBe(0)
    expect(failures(({ workflows }) => {
      workflows['ci-pr.yml'].jobs.approval.if = 'process.exit(42)'
    })).toContainEqual(expect.objectContaining({ name: '关闭事件跳过审批' }))
  })
})
