import { performance } from 'node:perf_hooks'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanupReleaseFixtures, createReleaseFixture, packages } from './repoctl-release/fixtures'

afterEach(cleanupReleaseFixtures)

it('does not republish acknowledged uploads while npm metadata is delayed after an OIDC failure', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish((args, attempt) => {
    if (attempt === 1) {
      // pnpm 12.5.1 在递归发布失败时没有写入部分成功的 summary。
      return { status: 1, stdout: `\u001B[32m✅ Published package ${packages[0].name}@1.0.0\u001B[0m\r\n`, stderr: 'ERR_PNPM_ID_TOKEN_GITHUB_INVALID_RESPONSE: HTTP 503\nFailed to publish package: 404 Not Found' }
    }
    expect(args.filter((_, index) => args[index - 1] === '--filter')).toEqual([packages[1].name])
    fixture.summary([packages[1]])
    packages.forEach(pkg => fixture.visible.add(pkg.name))
    return { status: 0, stdout: '', stderr: '' }
  })

  expect(await fixture.run()).toEqual(expect.arrayContaining(packages))
  expect(fixture.publishes).toHaveLength(2)
})

it('uses partial summaries and keeps them when a later retry fails permanently', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish((args, attempt) => {
    if (attempt === 1) {
      fixture.summary([packages[0]])
      return { status: 1, stdout: '', stderr: 'HTTP 503 Service Unavailable' }
    }
    expect(args.filter((_, index) => args[index - 1] === '--filter')).toEqual([packages[1].name])
    fixture.summary([])
    return { status: 1, stdout: '', stderr: 'E403 Forbidden' }
  })

  await expect(fixture.run()).rejects.toThrow('command failed:')
  expect(await fixture.readSummary()).toEqual({ publishedPackages: [packages[0]] })
  expect(fixture.publishes).toHaveLength(2)
  expect(await fixture.progress()).toMatchObject({
    status: 'failed',
    acceptedPackages: [packages[0]],
    confirmedPackages: [],
  })
})

it('refreshes registry state after backoff before retrying a staged conflict', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish((_args, attempt) => {
    if (attempt === 1) {
      return { status: 1, stdout: '', stderr: '409 Conflict: Cannot publish over previously staged version' }
    }
    throw new Error('Versions that became visible during backoff must not be republished')
  })
  fixture.sleep.mockImplementation(async () => {
    packages.forEach(pkg => fixture.visible.add(pkg.name))
  })

  expect(await fixture.run()).toEqual(expect.arrayContaining(packages))
  expect(fixture.publishes).toHaveLength(1)
})

it('waits for acknowledged uploads to become visible without uploading them again', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => ({ status: 1, stdout: packages.map(pkg => `✅ Published package ${pkg.name}@${pkg.version}`).join('\n'), stderr: 'HTTP 503' }))
  fixture.sleep.mockImplementation(async () => {
    packages.forEach(pkg => fixture.visible.add(pkg.name))
  })

  expect(await fixture.run()).toEqual(expect.arrayContaining(packages))
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep).toHaveBeenCalledTimes(1)
})

it('fails explicitly if acknowledged uploads never become visible', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => ({ status: 1, stdout: packages.map(pkg => `✅ Published package ${pkg.name}@${pkg.version}`).join('\n'), stderr: 'HTTP 503' }))

  await expect(fixture.run()).rejects.toThrow(/visibility confirmation timed out.*pending versions:/)
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep.mock.calls.reduce((total, [milliseconds]) => total + milliseconds, 0)).toBe(300_000)
  expect(await fixture.readSummary()).toEqual({ publishedPackages: packages })
  expect(await fixture.progress()).toMatchObject({
    status: 'failed',
    acceptedPackages: packages,
    confirmedPackages: [],
  })
})

it.each(['E403 Forbidden', '404 Not Found'])('does not retry permanent failures: %s', async (stderr) => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => ({ status: 1, stdout: '', stderr }))

  await expect(fixture.run()).rejects.toThrow('command failed:')
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep).not.toHaveBeenCalled()
})

it('does not accept another version or an attempted upload as an acknowledgement', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => ({
    status: 1,
    stdout: `✅ Published package ${packages[0].name}@0.9.0\n📦 ${packages[1].name}@2.0.0 → registry\n`,
    stderr: 'HTTP 503 Service Unavailable',
  }))

  await expect(fixture.run()).rejects.toThrow('command failed after 3 publish attempts')
  expect(fixture.publishes).toHaveLength(3)
  expect(fixture.publishes[2].filter((_, index) => fixture.publishes[2][index - 1] === '--filter')).toEqual(packages.map(pkg => pkg.name))
})

it('preserves ordinary successful publishing and its summary', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => {
    fixture.summary()
    packages.forEach(pkg => fixture.visible.add(pkg.name))
    return { status: 0, stdout: '', stderr: '' }
  })

  expect(await fixture.run()).toEqual(packages)
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep).not.toHaveBeenCalled()
})

it('confirms delayed metadata after an otherwise successful upload', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => {
    fixture.summary()
    return { status: 0, stdout: '', stderr: '' }
  })
  fixture.sleep.mockImplementation(async () => {
    expect(await fixture.progress()).toMatchObject({
      status: 'confirming',
      acceptedPackages: packages,
      confirmedPackages: [],
    })
    packages.forEach(pkg => fixture.visible.add(pkg.name))
  })

  expect(await fixture.run()).toEqual(packages)
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.sleep).toHaveBeenCalled()
  expect(await fixture.progress()).toEqual({
    schemaVersion: 1,
    status: 'complete',
    candidates: packages,
    acceptedPackages: packages,
    confirmedPackages: packages,
  })
})
