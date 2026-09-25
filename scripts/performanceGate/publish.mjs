import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { aggregatePlan } from './aggregate.mjs'
import { assertSha, createMatrix, needsSmoke, policy, statusContext, targetKey } from './contract.mjs'
import { pages, request } from './github.mjs'
import { verifySmoke } from './smokeReport.mjs'

const marker = '<!-- performance-v2 -->'

export function validatePlan(plan, run, repository) {
  if (plan.schemaVersion !== 2 || plan.purpose !== 'full' || plan.repository !== repository || String(plan.runId) !== String(run.id) || plan.driverSha !== run.head_sha || plan.samplingContract !== policy.samplingContract || !Array.isArray(plan.targets) || plan.targets.length > 2) {
    throw new Error('Untrusted performance plan provenance')
  }
  for (const target of plan.targets) {
    assertSha(target.headSha)
    if (target.baselineSha !== policy.baselineSha || target.key !== targetKey(target) || target.id !== (target.prNumber ? `pr-${target.prNumber}` : 'main') || (target.prNumber !== null && (!Number.isSafeInteger(target.prNumber) || target.prNumber < 1))) {
      throw new Error('Invalid planned target')
    }
  }
  if (new Set(plan.targets.map(t => t.id)).size !== plan.targets.length || JSON.stringify(plan.matrix) !== JSON.stringify(createMatrix(plan.targets))) {
    throw new Error('Invalid planned shard set')
  }
}

export async function publishComment(target, body, get = request) {
  if (!target.prNumber) {
    return false
  }
  const pull = await get(`/pulls/${target.prNumber}`)
  if (pull.state !== 'open' || pull.head.sha !== target.headSha) {
    return false
  }
  const comments = await pages(`/issues/${target.prNumber}/comments`, get)
  const previous = comments.find(c => c.user?.type === 'Bot' && c.body?.includes(marker))
  // 在真正写入前再次读取 HEAD，避免异步报告覆盖新提交。
  const fresh = await get(`/pulls/${target.prNumber}`)
  if (fresh.head.sha !== target.headSha || fresh.state !== 'open') {
    return false
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

async function smokeStatus(headSha) {
  const result = await request(`/actions/workflows/ci-performance.yml/runs?event=pull_request&head_sha=${headSha}&per_page=10`)
  const run = result.workflow_runs.find(r => r.head_sha === headSha && r.name === 'Performance Smoke')
  return !run ? '未运行' : run.status !== 'completed' ? '运行中' : run.conclusion === 'success' ? '通过或无需冒烟' : '🔴 未通过'
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const run = await request(`/actions/runs/${event.workflow_run.id}`)
  const repository = process.env.GITHUB_REPOSITORY
  if (run.head_repository?.full_name !== repository && run.event !== 'pull_request') {
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
      const statuses = await pages(`/commits/${target.headSha}/statuses`)
      if (!statuses.some(s => s.context === statusContext(target) && s.target_url === run.html_url && s.creator?.type === 'Bot')) {
        throw new Error('Missing trusted attempt registration')
      }
      await request(`/statuses/${target.headSha}`, { context: statusContext(target), state: target.status === 'passed' ? 'success' : 'failure', target_url: run.html_url, description: target.status === 'passed' ? '完整三平台性能通过' : `完整性能未通过：${target.status}` })
      const lines = ['## 性能检查', '', `HEAD: \`${target.headSha}\``, '', `PR 正确性冒烟：${await smokeStatus(target.headSha)}。`, '', `完整性能：已完成，${target.status === 'passed' ? '✅ passed' : `🔴 ${target.status}`}。`, '', '| 平台 | 通过 | 回退 | 不稳定 | 不完整 |', '| --- | ---: | ---: | ---: | ---: |']
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
  else if (run.name === 'Performance Smoke' && run.event === 'pull_request' && run.path === '.github/workflows/ci-performance.yml') {
    const pulls = await request(`/commits/${assertSha(run.head_sha)}/pulls`)
    const preferred = run.pull_requests?.[0]?.number
    const matches = pulls.filter(p => p.state === 'open' && p.head.sha === run.head_sha && p.head.ref === run.head_branch && p.head.repo?.full_name === run.head_repository?.full_name)
    const pull = matches.find(p => p.number === preferred) ?? matches[0]
    if (!pull) {
      return
    }
    const target = { prNumber: pull.number, headSha: run.head_sha, baselineSha: policy.baselineSha }
    const statuses = await pages(`/commits/${target.headSha}/statuses`)
    const previous = statuses.find(s => s.context === statusContext(target))
    // 已完成的完整报告优先；晚到的 smoke 不覆盖逐平台结论。
    if (previous && previous.state !== 'pending') {
      return
    }
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
    const full = previous ? `[运行中](${previous.target_url})` : pull.labels.some(l => l.name === policy.label) ? '排队，等待 nightly' : '未运行'
    await publishComment(target, `## 性能检查\n\nHEAD: \`${target.headSha}\`\n\nPR：${description}。\n\n完整性能：${full}。冒烟不计算 5% 门禁，也不代表性能验收通过。\n\n[冒烟运行记录](${run.html_url})`)
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
