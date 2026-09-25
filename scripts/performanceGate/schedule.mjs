import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { assertSha, createMatrix, policy, statusContext, targetKey } from './contract.mjs'
import { pages, request } from './github.mjs'

export async function resolveTarget(pr, get = request) {
  if (pr) {
    const pull = await get(`/pulls/${pr}`)
    if (pull.state !== 'open') {
      throw new Error('Performance target PR must be open')
    }
    return { id: `pr-${pull.number}`, prNumber: pull.number, headSha: assertSha(pull.head.sha), headRepository: pull.head.repo.full_name, baselineSha: policy.baselineSha }
  }
  const repo = await get('')
  const ref = await get(`/git/ref/heads/${encodeURIComponent(repo.default_branch)}`)
  return { id: 'main', prNumber: null, headSha: assertSha(ref.object.sha), headRepository: process.env.GITHUB_REPOSITORY, baselineSha: policy.baselineSha }
}

export async function previousAttempt(target, get = request) {
  const statuses = await pages(`/commits/${target.headSha}/statuses`, get)
  return statuses.find(status => status.context === statusContext(target))
}

/**
 * 根据固定提交记录选择待验收目标。
 * @param {{ prNumber?: number, get?: typeof request }} options 调度输入与可替换的只读查询。
 */
export async function selectTargets({ prNumber = undefined, get = request }) {
  const candidates = []
  const reused = []
  const consider = async (target) => {
    const same = candidates.find(candidate => candidate.key === targetKey(target))
    if (same) {
      reused.push({ ...target, previous: { state: 'pending', targetId: same.id } })
      return false
    }
    const previous = await previousAttempt(target, get)
    if (previous) {
      reused.push({ ...target, previous: { state: previous.state, url: previous.target_url } })
      return false
    }
    candidates.push({ ...target, key: targetKey(target) })
    return true
  }
  await consider(await resolveTarget(undefined, get))
  if (prNumber) {
    await consider(await resolveTarget(prNumber, get))
  }
  else {
    const pulls = (await pages('/pulls?state=open', get)).filter(pull => pull.labels.some(label => label.name === policy.label))
    const queue = []
    for (const pull of pulls) {
      const events = await pages(`/issues/${pull.number}/events`, get)
      const labels = events.filter(event => event.event === 'labeled' && event.label?.name === policy.label)
      queue.push({ number: pull.number, since: labels.at(-1)?.created_at ?? pull.created_at })
    }
    queue.sort((a, b) => a.since.localeCompare(b.since) || a.number - b.number)
    for (const item of queue) {
      if (await consider(await resolveTarget(item.number, get))) {
        break
      }
    }
  }
  return { targets: candidates, reused }
}

async function main() {
  const driverSha = assertSha(process.env.GITHUB_SHA)
  if (process.env.GITHUB_REF !== `refs/heads/${process.env.DEFAULT_BRANCH}`) {
    throw new Error('Nightly planner must run from the default branch')
  }
  const input = process.env.PR_NUMBER?.trim()
  if (input && !/^[1-9]\d*$/.test(input)) {
    throw new Error('Invalid PR number')
  }
  const selection = await selectTargets({ prNumber: input ? Number(input) : undefined })
  const plan = { schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha, repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID, ...selection }
  plan.matrix = createMatrix(plan.targets)
  const url = `${process.env.GITHUB_SERVER_URL}/${plan.repository}/actions/runs/${plan.runId}`
  for (const reused of plan.reused) {
    reused.previous.url ??= url
  }
  await mkdir('performance-plan', { recursive: true })
  await writeFile('performance-plan/plan.json', `${JSON.stringify(plan, null, 2)}\n`)
  // 先登记不可自动重复的提交状态，再允许只读采样任务启动。
  for (const target of plan.targets) {
    await request(`/statuses/${target.headSha}`, { state: 'pending', context: statusContext(target), target_url: url, description: '完整性能验收排队；不是 PR 冒烟检查' })
  }
  await appendFile(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include: plan.matrix })}\nhas_work=${plan.matrix.length > 0}\n`)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Nightly 性能计划\n\n目标：${plan.targets.map(t => `${t.id} @ ${t.headSha}`).join(', ') || '无新增目标'}\n\n${plan.reused.map(t => `- ${t.id}：复用[已有验收记录](${t.previous.url})（${t.previous.state}），不重复采样。`).join('\n')}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
