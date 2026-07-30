import { describe, expect, it, vi } from 'vitest'
import {
  COMMENT_MARKER,
  findExistingComment,
  renderFailureComment,
  renderSuccessComment,
  upsertComment,
  validateArtifact,
} from '../.github/scripts/upsert-runtime-size-comment.mjs'

function createArtifact() {
  const tiers = [
    'reactivity-core',
    'minimal-app',
    'typical-page',
    'complex-component',
    'full-provider',
  ]
  const createReport = (commit, offset = 0) => ({
    version: 2,
    generatedAt: '2026-07-30T00:00:00.000Z',
    commit,
    targets: [
      {
        id: 'weapp',
        label: 'artifact label is ignored',
        tiers: tiers.map((id, index) => ({
          id,
          label: 'artifact tier label is ignored',
          dev: { bytes: 2048 + index * 1024 + offset },
          production: { bytes: 1024 + index * 512 + offset },
        })),
      },
      {
        id: 'web',
        label: 'artifact label is ignored',
        tiers: tiers.map((id, index) => ({
          id,
          label: 'artifact tier label is ignored',
          dev: { bytes: 4096 + index * 1024 + offset },
          production: { bytes: 2048 + index * 512 + offset, gzipBytes: 1024 + index * 256 + offset },
        })),
      },
    ],
  })
  return {
    version: 2,
    kind: 'wevu-runtime-size-pr-report',
    repository: 'owner/repo',
    prNumber: 42,
    headSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    current: createReport('c'.repeat(12), 1024),
    baseline: createReport('d'.repeat(12)),
  }
}

describe('runtime size PR comment', () => {
  it('validates metadata and renders only configured targets', () => {
    const artifact = validateArtifact(createArtifact(), {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })
    const body = renderSuccessComment(artifact)

    expect(body).toContain(COMMENT_MARKER)
    expect(body).toContain('| 微信小程序 | 7.00 KiB (+1.00 KiB, +16.67%) | 4.00 KiB (+1.00 KiB, +33.33%) | 不适用 |')
    expect(body).toContain('| 响应式核心 | 3.00 KiB (+1.00 KiB, +50.00%) | 2.00 KiB (+1.00 KiB, +100.00%) | 不适用 |')
    expect(body).toContain('| 复杂组件 |')
    expect(body).toContain('| Web |')
  })

  it('rejects mismatched metadata and invalid gzip fields', () => {
    expect(() => validateArtifact(createArtifact(), {
      repository: 'other/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('repository')

    const artifact = createArtifact()
    artifact.current.targets[0].tiers[0].production.gzipBytes = 10
    expect(() => validateArtifact(artifact, {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('must not contain gzipBytes')

    const missingTier = createArtifact()
    missingTier.current.targets[0].tiers.pop()
    expect(() => validateArtifact(missingTier, {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('configured runtime tiers')

    const reorderedTier = createArtifact()
    reorderedTier.current.targets[1].tiers.reverse()
    expect(() => validateArtifact(reorderedTier, {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('must be reactivity-core')

    const extraTier = createArtifact()
    extraTier.current.targets[0].tiers.push(extraTier.current.targets[0].tiers[0])
    expect(() => validateArtifact(extraTier, {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('configured runtime tiers')

    const duplicateTier = createArtifact()
    duplicateTier.current.targets[0].tiers[1] = duplicateTier.current.targets[0].tiers[0]
    expect(() => validateArtifact(duplicateTier, {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('must be minimal-app')

    const unsafeCommit = createArtifact()
    unsafeCommit.current.commit = '`unsafe`'
    expect(() => validateArtifact(unsafeCommit, {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('hexadecimal Git commit')
  })

  it('finds only an existing bot marker comment', () => {
    expect(findExistingComment([
      { id: 1, user: { type: 'User' }, body: COMMENT_MARKER },
      { id: 2, user: { type: 'Bot' }, body: `prefix ${COMMENT_MARKER}` },
    ])?.id).toBe(2)
    expect(renderFailureComment('https://example.test/run', 'failed')).toContain('failed')
  })

  it('creates a comment when no marker exists', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 1 })

    await upsertComment({
      apiUrl: 'https://api.example.test',
      token: 'token',
      repository: 'owner/repo',
      prNumber: 42,
      body: 'report',
      request,
    })

    expect(request).toHaveBeenLastCalledWith(
      'https://api.example.test',
      'token',
      '/repos/owner/repo/issues/42/comments',
      { method: 'POST', body: JSON.stringify({ body: 'report' }) },
    )
  })

  it('updates the existing marker comment', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce([{ id: 7, user: { type: 'Bot' }, body: COMMENT_MARKER }])
      .mockResolvedValueOnce({ id: 7 })

    await upsertComment({
      apiUrl: 'https://api.example.test',
      token: 'token',
      repository: 'owner/repo',
      prNumber: 42,
      body: 'updated report',
      request,
    })

    expect(request).toHaveBeenLastCalledWith(
      'https://api.example.test',
      'token',
      '/repos/owner/repo/issues/comments/7',
      { method: 'PATCH', body: JSON.stringify({ body: 'updated report' }) },
    )
  })
})
