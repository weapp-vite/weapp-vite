import fs from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createGitHubClient } from './github.mjs'
import { affectedPackages, changesetPath, hasManualChangeset, isUnmodifiedGenerated, marker, readWorkspaces, releaseLevel, renderChangeset } from './policy.mjs'

async function commentOnce(client, number, body) {
  const comments = await client.listComments(number)
  const content = `${marker}\n${body}`
  if (!comments.some(comment => comment.user?.type === 'Bot' && comment.body === content)) {
    await client.createComment(number, content)
  }
}

function assertCurrent(pull, { repository, number, expectedHeadSha, expectedBaseSha }) {
  if (pull.number !== number || pull.state !== 'open' || pull.base?.repo?.full_name !== repository
    || pull.head?.sha !== expectedHeadSha || pull.base?.sha !== expectedBaseSha) {
    throw new Error('PR 已变化，请审批最新提交对应的运行。')
  }
}

/** 只提交尚无人工记录的已审批 revision；Git ref 更新禁止强推。 */
export async function processPullRequest(client, identity) {
  const { number, expectedHeadSha, expectedBaseSha } = identity
  if (!Number.isSafeInteger(number) || number <= 0
    || ![expectedHeadSha, expectedBaseSha].every(sha => /^[a-f\d]{40}$/u.test(sha))) {
    throw new Error('Expected a frozen PR identity')
  }
  const pull = await client.getPullRequest(number)
  assertCurrent(pull, { ...identity, repository: client.repository })
  if (pull.draft || /^(?:pnpm-release\/|release\/pnpm-version)/u.test(pull.head.ref)) {
    return { action: 'skipped', number }
  }
  const files = await client.getPullRequestFiles(number)
  if (hasManualChangeset(files, number)) {
    return { action: 'manual', number }
  }
  if (pull.head.repo.full_name !== client.repository) {
    await commentOnce(client, number, '如果此 PR 涉及公开包行为，请手动添加中文 `.changeset/*.md`。fork PR 不写入自动提交，也不发布 preview 包。')
    return { action: 'fork', number }
  }
  const target = changesetPath(number)
  const existing = await client.getContent(target, expectedHeadSha)
  if (existing !== undefined && !isUnmodifiedGenerated(existing)) {
    return { action: 'manual', number }
  }
  const packages = affectedPackages(files, await readWorkspaces(client, expectedHeadSha))
  if (!packages.length && existing === undefined) {
    return { action: 'skipped', number }
  }
  let content
  try {
    if (packages.length) {
      content = renderChangeset({ packages, level: releaseLevel(pull.title, pull.labels), number, title: pull.title })
    }
  }
  catch (error) {
    await commentOnce(client, number, error.message)
    return { action: 'needs-summary', number }
  }
  if (content === existing) {
    return { action: 'unchanged', number }
  }
  const commit = await client.getCommit(expectedHeadSha)
  const blob = content ? await client.createBlob(content) : undefined
  const tree = await client.createTree(commit.tree.sha, [{ path: target, mode: '100644', type: 'blob', sha: blob?.sha ?? null }])
  const next = await client.createCommit(content ? 'chore(changeset): 补充 PR 发布记录' : 'chore(changeset): 移除不再需要的自动发布记录', tree.sha, [expectedHeadSha])
  assertCurrent(await client.getPullRequest(number), { ...identity, repository: client.repository })
  const ref = await client.getRef(`heads/${pull.head.ref}`)
  if (ref.object.sha !== expectedHeadSha) {
    throw new Error('PR 分支已更新，拒绝覆盖新提交。')
  }
  await client.updateRef(pull.head.ref, next.sha)
  await commentOnce(client, number, content
    ? '已生成发布记录；请审阅版本级别和中文摘要。自动提交后，GitHub 可能要求先点击 **Approve workflows to run**，再批准新一轮 `pr-ci-approval`。手写 changeset 始终优先。'
    : 'PR 已不包含需要发布的包改动，已移除未被人工修改的自动发布记录。请按新提交重新审批检查。')
  return { action: content ? 'committed' : 'removed', number, path: target, sha: next.sha }
}

async function main() {
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request_target') {
    throw new Error('Automatic release intent requires a trusted pull_request_target workflow')
  }
  const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const client = createGitHubClient({ token: process.env.GITHUB_TOKEN, repository: process.env.GITHUB_REPOSITORY })
  const result = await processPullRequest(client, {
    number: event.pull_request.number,
    expectedHeadSha: event.pull_request.head.sha,
    expectedBaseSha: event.pull_request.base.sha,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `自动 changeset：${result.action}，PR #${result.number}。\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
