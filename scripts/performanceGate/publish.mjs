import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { validateNativePrContext } from '../../.github/scripts/native-pr-context.mjs'
import { downloadPrContext, validatePerformancePrContext } from '../../.github/scripts/resolve-performance-runs.mjs'
import { aggregatePlan } from './aggregate.mjs'
import { assertSha, createMatrix, frozenManifest, isReportSamplingContract, needsSmoke, policy, statusContext, targetKey } from './contract.mjs'
import { pages, request } from './github.mjs'
import { verifySmoke } from './smokeReport.mjs'

const marker = '<!-- performance-v2 -->'

export function validatePlan(plan, run, repository, { candidate = false } = {}) {
  if (plan.schemaVersion !== 2 || plan.purpose !== 'full' || plan.repository !== repository || String(plan.runId) !== String(run.id) || plan.driverSha !== run.head_sha || !isReportSamplingContract(plan.samplingContract) || !Array.isArray(plan.targets) || plan.targets.length > 2 || JSON.stringify(plan.manifest) !== JSON.stringify(frozenManifest())) {
    throw new Error('Untrusted performance plan provenance')
  }
  if (candidate) {
    const invocation = plan.invocation
    const validRef = typeof invocation?.ref === 'string' && (run.event === 'push'
      ? invocation.ref === `refs/tags/codex/performance-candidate/${plan.driverSha}` && invocation.ref === `refs/tags/${run.head_branch}`
      : [`refs/heads/${run.head_branch}`, `refs/tags/${run.head_branch}`].includes(invocation.ref))
    if (plan.execution !== 'candidate' || plan.samplingContract !== policy.samplingContract
      || run.name !== 'Candidate Performance' || run.path !== '.github/workflows/candidate-performance.yml'
      || run.head_repository?.full_name !== repository || !['push', 'workflow_dispatch'].includes(run.event)
      || invocation?.event !== run.event || !validRef
      || !Array.isArray(plan.reused) || plan.targets.length + plan.reused.length !== 1) {
      throw new Error('Untrusted candidate performance invocation')
    }
  }
  else if (plan.execution === 'candidate') {
    throw new Error('Candidate plans require explicit candidate provenance validation')
  }
  for (const target of candidate ? [...plan.targets, ...plan.reused] : plan.targets) {
    assertSha(target.headSha)
    const validIdentity = candidate
      ? target.kind === 'candidate' && target.prNumber === null && target.id === `candidate-${target.headSha}` && target.headSha === plan.driverSha && target.headRepository === repository
      : target.id === (target.prNumber ? `pr-${target.prNumber}` : 'main') && (target.prNumber === null || (Number.isSafeInteger(target.prNumber) && target.prNumber > 0))
    if (target.baselineSha !== policy.baselineSha || target.key !== targetKey(target, plan.samplingContract) || !validIdentity) {
      throw new Error('Invalid planned target')
    }
  }
  if (new Set(plan.targets.map(t => t.id)).size !== plan.targets.length || JSON.stringify(plan.matrix) !== JSON.stringify(createMatrix(plan.targets))) {
    throw new Error('Invalid planned shard set')
  }
}

export async function publishComment(target, body, get = request, smokeDescription = '') {
  if (!target.prNumber) {
    return false
  }
  const pull = await get(`/pulls/${target.prNumber}`)
  if (pull.state !== 'open' || pull.head.sha !== target.headSha || (target.baseSha && pull.base?.sha !== target.baseSha)) {
    return false
  }
  const comments = await pages(`/issues/${target.prNumber}/comments`, get)
  const previous = comments.find(c => c.user?.type === 'Bot' && c.body?.includes(marker))
  // 在真正写入前再次读取 HEAD，避免异步报告覆盖新提交。
  const fresh = await get(`/pulls/${target.prNumber}`)
  if (fresh.head.sha !== target.headSha || fresh.state !== 'open' || (target.baseSha && fresh.base?.sha !== target.baseSha)) {
    return false
  }
  // 晚到的 smoke 只更新冒烟状态，保留同一 HEAD 已发布的完整明细。
  if (smokeDescription && previous?.body.includes(`HEAD: \`${target.headSha}\``) && previous.body.includes('完整性能：已完成')) {
    body = previous.body.replace(marker, '').trim().replace(/PR 正确性冒烟：[^\n]*/u, `PR 正确性冒烟：${smokeDescription}。`)
  }
  const text = `${marker}\n${body}`
  if (previous) {
    await get(`/issues/comments/${previous.id}`, { body: text }, 'PATCH')
  }
  else {
    await get(`/issues/${target.prNumber}/comments`, { body: text })
  }
  return true
}

/** 合并手动与原生运行的时间顺序，并遍历全部子任务以读取最新冒烟结论。 */
export async function smokeStatus(target, { get = request, readContext = downloadPrContext, repository = process.env.GITHUB_REPOSITORY } = {}) {
  if (!target.prNumber) {
    return '未运行'
  }
  const repo = await get('')
  const [manual, native] = await Promise.all([
    get('/actions/workflows/ci-performance.yml/runs?event=workflow_dispatch&per_page=100'),
    get(`/actions/workflows/ci-pr.yml/runs?event=pull_request&head_sha=${target.headSha}&per_page=100`),
  ])
  const runs = [...(manual.workflow_runs ?? []), ...(native.workflow_runs ?? [])].sort((a, b) => b.id - a.id)
  for (const run of runs) {
    const isNative = run.name === 'PR CI' && run.path === '.github/workflows/ci-pr.yml' && run.event === 'pull_request'
    const isManual = run.name === 'Performance Smoke' && run.path === '.github/workflows/ci-performance.yml'
      && run.event === 'workflow_dispatch' && run.head_branch === repo.default_branch && run.head_repository?.full_name === repository
    if (!isNative && !isManual) {
      continue
    }
    try {
      const input = await readContext({ apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com', token: process.env.GITHUB_TOKEN, repository, run })
      const context = isNative ? validateNativePrContext(input, run, repository) : validatePerformancePrContext(input, run, repository)
      if (!context.shouldRun || context.headSha !== target.headSha || context.prNumber !== target.prNumber || (target.baseSha && context.baseSha !== target.baseSha)) {
        continue
      }
      if (isManual) {
        return run.status !== 'completed' ? '运行中' : run.conclusion === 'success' ? '通过或无需冒烟' : '🔴 未通过'
      }
      const jobs = await pages(`/actions/runs/${run.id}/jobs?filter=latest`, get, 'jobs')
      const smoke = jobs.find(job => job.name.startsWith('Performance Smoke /') && job.steps?.some(step => step.name === 'Run correctness smoke'))
      return !smoke || smoke.status !== 'completed' ? '运行中' : smoke.conclusion === 'success' ? '通过或无需冒烟' : '🔴 未通过'
    }
    catch {
      // 未通过审批或提交身份不符的运行不能提供当前提交的冒烟结论。
    }
  }
  return '未运行'
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const run = await request(`/actions/runs/${event.workflow_run.id}`)
  const repository = process.env.GITHUB_REPOSITORY
  if (run.head_repository?.full_name !== repository) {
    throw new Error('Unexpected workflow repository')
  }
  const root = path.resolve(process.env.PERFORMANCE_ARTIFACTS)
  if (run.name === 'Nightly Performance') {
    const repo = await request('')
    if (!['schedule', 'workflow_dispatch'].includes(run.event) || run.head_branch !== repo.default_branch || run.path !== '.github/workflows/nightly-performance.yml') {
      throw new Error('Nightly reporting requires a trusted default-branch run')
    }
    const plan = JSON.parse(await readFile(path.join(root, 'performance-plan', 'plan.json'), 'utf8'))
    validatePlan(plan, run, repository)
    const report = await aggregatePlan(plan, root)
    for (const target of report.targets) {
      const context = statusContext(target, plan.samplingContract)
      const statuses = await pages(`/commits/${target.headSha}/statuses`)
      if (!statuses.some(s => s.context === context && s.target_url === run.html_url && s.creator?.type === 'Bot')) {
        throw new Error('Missing trusted attempt registration')
      }
      await request(`/statuses/${target.headSha}`, { context, state: target.status === 'passed' ? 'success' : 'failure', target_url: run.html_url, description: target.status === 'passed' ? '完整三平台性能通过' : `完整性能未通过：${target.status}` })
      // 旧契约完成自己的状态登记，但不得覆盖同一 HEAD 的新契约评论。
      if (plan.samplingContract !== policy.samplingContract) {
        continue
      }
      const lines = ['## 性能检查', '', `HEAD: \`${target.headSha}\``, '', `PR 正确性冒烟：${await smokeStatus(target)}。`, '', `完整性能：已完成，${target.status === 'passed' ? '✅ passed' : `🔴 ${target.status}`}。`, '', '| 平台 | 通过 | 回退 | 不稳定 | 不完整 |', '| --- | ---: | ---: | ---: | ---: |']
      for (const system of target.systems) {
        const counts = { passed: 0, regression: 0, unstable: 0, incomplete: 0 }
        for (const part of system.parts) {
          if (!part.gate.scenarios.length) {
            counts.incomplete++
          }
          for (const row of part.gate.scenarios) {
            counts[row.status]++
          }
        }
        lines.push(`| ${system.os} | ${counts.passed} | 🔴 ${counts.regression} | 🔴 ${counts.unstable} | 🔴 ${counts.incomplete} |`)
      }
      lines.push('', `固定基线：\`${target.baselineSha}\`。完整逐场景结果、启用成本和原始样本见 [Nightly 报告](${run.html_url})。`, '', 'PR 冒烟通过不代表达到 5% 性能要求；历史回退及不可比较项继续保留。')
      await publishComment(target, lines.join('\n'))
    }
  }
  else if (run.name === 'Performance Smoke' && run.event === 'workflow_dispatch' && run.path === '.github/workflows/ci-performance.yml') {
    const repo = await request('')
    if (run.head_branch !== repo.default_branch) {
      throw new Error('Smoke reporting requires a trusted default-branch run')
    }
    const input = JSON.parse(await readFile(path.join(root, 'pr-context', 'context.json'), 'utf8'))
    if (!input.isPr) {
      return
    }
    const context = validatePerformancePrContext(input, run, repository)
    const pull = await request(`/pulls/${context.prNumber}`)
    if (!context.shouldRun || pull.state !== 'open' || pull.head.sha !== context.headSha || pull.base?.sha !== context.baseSha
      || pull.head.ref !== context.headRef || pull.head.repo?.full_name !== context.headRepository) {
      return
    }
    const target = { prNumber: context.prNumber, headSha: context.headSha, baseSha: context.baseSha, baselineSha: policy.baselineSha }
    const statuses = await pages(`/commits/${target.headSha}/statuses`)
    const previous = statuses.find(s => s.context === statusContext(target) && s.creator?.type === 'Bot')
    let description = '🔴 未通过'
    const jobs = await request(`/actions/runs/${run.id}/jobs?per_page=100`)
    const smoke = jobs.jobs.flatMap(j => j.steps ?? []).find(s => s.name === 'Run correctness smoke')
    if (run.conclusion === 'success' && smoke?.conclusion === 'skipped') {
      const files = await pages(`/pulls/${pull.number}/files`)
      if (files.length >= 3000 || needsSmoke(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)))) {
        throw new Error('Relevant PR paths cannot skip smoke')
      }
      description = '无需冒烟（无关路径变更）'
    }
    else if (run.conclusion === 'success') {
      const data = JSON.parse(await readFile(path.join(root, 'performance-smoke-report', 'smoke.json'), 'utf8'))
      verifySmoke(data, target.headSha)
      if (data.prNumber !== target.prNumber || smoke?.conclusion !== 'success') {
        throw new Error('Smoke target or execution mismatch')
      }
      description = '✅ 正确性冒烟通过'
    }
    const full = previous ? previous.state === 'pending' ? `[运行中](${previous.target_url})` : `已完成，复用[已有验收记录](${previous.target_url})（${previous.state === 'success' ? '既有验收通过' : '🔴 未通过'}）` : '未运行，需手动启动 Nightly Performance'
    await publishComment(target, `## 性能检查\n\nHEAD: \`${target.headSha}\`\n\nPR 正确性冒烟：${description}。\n\n完整性能：${full}。冒烟不计算 5% 门禁，也不代表性能验收通过。\n\n[冒烟运行记录](${run.html_url})`, request, description)
  }
  else {
    throw new Error('Unexpected performance workflow')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
