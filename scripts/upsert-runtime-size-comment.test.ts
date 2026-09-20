import { describe, expect, it, vi } from 'vitest'
import {
  COMMENT_MARKER,
  findExistingComment,
  renderFailureComment,
  renderSuccessComment,
  upsertComment,
  validateArtifact,
} from '../.github/scripts/upsert-runtime-size-comment.mjs'

function createArtifact(version = 3) {
  const tiers = [
    'reactivity-core',
    'minimal-app',
    'typical-page',
    'complex-component',
    'full-provider',
  ]
  const createReport = (commit, offset = 0, includeRetainedModules = true) => ({
    version,
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
          production: {
            bytes: 1024 + index * 512 + offset,
            ...(includeRetainedModules
              ? {
                  retainedModules: {
                    entry: `wevu-runtime-size-weapp-${id}-production.mjs`,
                    modules: [],
                  },
                }
              : {}),
          },
        })),
      },
      {
        id: 'web',
        label: 'artifact label is ignored',
        tiers: tiers.map((id, index) => ({
          id,
          label: 'artifact tier label is ignored',
          dev: { bytes: 4096 + index * 1024 + offset },
          production: {
            bytes: 2048 + index * 512 + offset,
            gzipBytes: 1024 + index * 256 + offset,
            ...(includeRetainedModules
              ? {
                  retainedModules: {
                    entry: `wevu-runtime-size-web-${id}-production.mjs`,
                    modules: [],
                  },
                }
              : {}),
          },
        })),
      },
    ],
  })
  return {
    version,
    kind: 'wevu-runtime-size-pr-report',
    repository: 'owner/repo',
    prNumber: 42,
    headSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    current: createReport('c'.repeat(12), 1024, version === 3),
    baseline: createReport('d'.repeat(12), 0, false),
  }
}

describe('runtime size PR comment', () => {
  it('validates metadata and renders only configured targets', () => {
    const artifact = validateArtifact(createArtifact(), {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    })
    expect(artifact.current.targets[0].tiers[0].production.retainedModules.entry).toBe(
      'wevu-runtime-size-weapp-reactivity-core-production.mjs',
    )
    expect(artifact.baseline.targets[0].tiers[0].production.retainedModules).toBeUndefined()
    const body = renderSuccessComment(artifact)

    expect(body).toContain(COMMENT_MARKER)
    expect(body).toContain('| 微信小程序 | 7.00 KiB (+1.00 KiB, +16.67%) | 4.00 KiB (+1.00 KiB, +33.33%) | 不适用 |')
    expect(body).toContain('| 响应式核心 | 3.00 KiB (+1.00 KiB, +50.00%) | 2.00 KiB (+1.00 KiB, +100.00%) | 不适用 |')
    expect(body).toContain('| 复杂组件 |')
    expect(body).toContain('| Web |')
  })

  it('accepts coherent v2 and v3 artifacts and rejects mixed or unsupported versions', () => {
    const expected = {
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'a'.repeat(40),
    }
    const v2 = validateArtifact(createArtifact(2), expected)
    const v3 = validateArtifact(createArtifact(3), expected)

    expect(v2.current.version).toBe(2)
    expect(v2.current.targets[0].tiers[0].production.retainedModules).toBeUndefined()
    expect(v3.current.version).toBe(3)
    expect(v3.current.targets[0].tiers[0].production.retainedModules.entry).toBe(
      'wevu-runtime-size-weapp-reactivity-core-production.mjs',
    )

    const mixed = createArtifact(3)
    mixed.baseline.version = 2
    expect(() => validateArtifact(mixed, expected)).toThrow(
      'artifact.baseline.version must match artifact.version (3)',
    )
    expect(() => validateArtifact(createArtifact(4), expected)).toThrow(
      'Unsupported runtime size artifact',
    )
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
