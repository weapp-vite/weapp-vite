/** PR 的 base.sha 是快照；身份使用分支、仓库及 head，实际 base 另读分支 ref。 */
export function samePullIdentity(pull, context, { baseRepositoryId, headRepositoryId } = {}) {
  return pull?.number === context.prNumber && pull.state === 'open'
    && pull.head?.sha === context.headSha && pull.head.ref === context.headRef
    && pull.base?.ref === context.baseRef && pull.base.repo?.full_name === context.repository
    && pull.head.repo?.full_name === context.headRepository
    && (baseRepositoryId === undefined || pull.base.repo.id === baseRepositoryId)
    && (headRepositoryId === undefined || pull.head.repo.id === headRepositoryId)
}

/** 合并提交必须按顺序只包含本轮实际 base 与 head 两个父节点。 */
export function matchesMergeParents(commit, mergeSha, baseSha, headSha) {
  return commit?.sha === mergeSha && commit.parents?.length === 2
    && commit.parents[0].sha === baseSha && commit.parents[1].sha === headSha
}
