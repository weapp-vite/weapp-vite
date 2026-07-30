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
  const createReport = (commit, offset = 0) => ({
    version: 1,
    generatedAt: '2026-07-30T00:00:00.000Z',
    commit,
    targets: [
      { id: 'weapp', label: '微信小程序', dev: { bytes: 2048 + offset }, production: { bytes: 1024 + offset } },
      { id: 'web', label: 'Web', dev: { bytes: 4096 + offset }, production: { bytes: 2048 + offset, gzipBytes: 1024 + offset } },
    ],
  })
  return {
    version: 1,
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
    expect(body).toContain('| 微信小程序 | 3.00 KiB (+1.00 KiB, +50.00%) | 2.00 KiB (+1.00 KiB, +100.00%) | 不适用 |')
    expect(body).toContain('| Web |')
  })

  it('rejects mismatched metadata and invalid gzip fields', () => {
    expect(() => validateArtifact(createArtifact(), {
      repository: 'other/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('repository')

    const artifact = createArtifact()
    artifact.current.targets[0].production.gzipBytes = 10
    expect(() => validateArtifact(artifact, {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })).toThrow('must not contain gzipBytes')

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
