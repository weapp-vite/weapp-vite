import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { needsSmoke, policy, statusContext } from '../../scripts/performanceGate/contract.mjs'
import { request as githubRequest, pages } from '../../scripts/performanceGate/github.mjs'
import { publishComment } from '../../scripts/performanceGate/publish.mjs'
import { verifySmoke } from '../../scripts/performanceGate/smokeReport.mjs'
import { validateNativePrContext } from './native-pr-context.mjs'
import { renderFailureComment, renderSuccessComment, upsertComment, validateArtifact } from './upsert-runtime-size-comment.mjs'

/** 汇总运行中只读取对应子 job 的结论，不能让其他矩阵失败冒充性能检查失败。 */
export function nativeReportJobs(jobs) {
  return {
    smoke: jobs.find(job => job.name.startsWith('Performance Smoke /') && job.steps?.some(step => step.name === 'Run correctness smoke')),
    runtime: jobs.find(job => job.name.startsWith('Wevu Runtime Size /') && job.name.endsWith('Runtime Size (Ubuntu / Node 24)')),
  }
}

async function currentPull(context, request) {
  const pull = await request(`/pulls/${context.prNumber}`)
  return pull.state === 'open' && pull.head?.sha === context.headSha && pull.base?.sha === context.baseSha
    && pull.head.ref === context.headRef && pull.base.ref === context.baseRef
    && pull.head.repo?.full_name === context.headRepository
    ? pull
    : null
}

/** 独立可信报告器验证原生 PR 身份及真实子任务后才发布评论。 */
export async function publishNativePrReport({ repository, run, context, jobs, request, readArtifact }) {
  if (run.name !== 'PR CI' || run.path !== '.github/workflows/ci-pr.yml' || run.event !== 'pull_request' || run.status !== 'completed') {
    throw new Error('Native reporting requires a completed PR CI run')
  }
  validateNativePrContext(context, run, repository)
  const pull = await currentPull(context, request)
  if (!pull) {
    return { published: false, reason: 'stale-pr' }
  }
  const base = await request(`/git/ref/heads/${encodeURIComponent(context.baseRef)}`)
  if (base.object?.sha !== context.baseSha) {
    return { published: false, reason: 'stale-base' }
  }
  const recent = await request(`/actions/workflows/ci-pr.yml/runs?event=pull_request&head_sha=${context.headSha}&per_page=100`)
  if (recent.workflow_runs.some(candidate => BigInt(candidate.id) > BigInt(run.id))) {
    return { published: false, reason: 'newer-run' }
  }
  const { smoke, runtime } = nativeReportJobs(jobs)
  const target = { prNumber: context.prNumber, headSha: context.headSha, baseSha: context.baseSha, baselineSha: policy.baselineSha }
  if (context.selections['ci-performance'] && smoke && smoke.conclusion !== 'skipped') {
    const step = smoke.steps.find(step => step.name === 'Run correctness smoke')
    let description = `🔴 ${smoke.conclusion || '未完成'}`
    if (smoke.conclusion === 'success' && step.conclusion === 'skipped') {
      const files = await pages(`/pulls/${context.prNumber}/files`, request)
      if (files.length >= 3000 || needsSmoke(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)))) {
        throw new Error('Relevant PR paths cannot skip smoke')
      }
      description = '无需冒烟（无关路径变更）'
    }
    else if (smoke.conclusion === 'success') {
      const report = await readArtifact('performance-smoke-report/smoke.json')
      verifySmoke(report, context.headSha)
      if (report.prNumber !== context.prNumber || step.conclusion !== 'success') {
        throw new Error('Smoke target or execution mismatch')
      }
      description = '✅ 正确性冒烟通过'
    }
    const statuses = await pages(`/commits/${context.headSha}/statuses`, request)
    const full = statuses.find(status => status.context === statusContext(target) && status.creator?.type === 'Bot')
    const complete = full ? `[已有完整验收记录](${full.target_url})（${full.state}）` : '未运行，需手动启动 Nightly Performance'
    await publishComment(target, `## 性能检查\n\nHEAD: \`${context.headSha}\`\n\nPR 正确性冒烟：${description}。\n\n完整性能：${complete}。冒烟不代表完整性能验收通过。\n\n[冒烟任务](${smoke.html_url})`, request, description)
  }
  if (context.selections['wevu-runtime-size'] && runtime && runtime.conclusion !== 'skipped') {
    const artifact = runtime.conclusion === 'success'
      ? validateArtifact(await readArtifact('wevu-runtime-size-report/report-full.json'), { repository, prNumber: context.prNumber, headSha: context.headSha, baseSha: context.baseSha })
      : null
    const body = artifact ? renderSuccessComment(artifact) : renderFailureComment(runtime.html_url, `任务状态为 \`${runtime.conclusion || '未完成'}\`。`)
    if (await currentPull(context, request)) {
      await upsertComment({
        repository,
        prNumber: context.prNumber,
        body,
        request: (_api, _token, pathname, options = {}) => request(pathname.replace(`/repos/${repository}`, ''), options.body ? JSON.parse(options.body) : undefined, options.method),
      })
    }
  }
  return { published: true }
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const run = await githubRequest(`/actions/runs/${event.workflow_run.id}`)
  const jobs = await pages(`/actions/runs/${run.id}/jobs?filter=latest`, githubRequest, 'jobs')
  const root = process.env.NATIVE_PR_ARTIFACTS || 'native-pr-artifacts'
  const readArtifact = async name => JSON.parse(await readFile(path.join(root, name), 'utf8'))
  // 拒绝/取消审批时没有冻结上下文，也没有已执行的验证任务。
  if (!jobs.some(job => job.name === 'Freeze approved PR target' && job.conclusion === 'success')) {
    return
  }
  const result = await publishNativePrReport({ repository: process.env.GITHUB_REPOSITORY, run, context: await readArtifact('pr-context/context.json'), jobs, request: githubRequest, readArtifact })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
