import { performance } from 'node:perf_hooks'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanupReleaseFixtures, createReleaseFixture, packages } from './repoctl-release/fixtures'

afterEach(cleanupReleaseFixtures)

it('runs metadata and post-publish hooks once after recovered versions become visible', async () => {
  const fixture = await createReleaseFixture()
  fixture.setPublish((_args, attempt) => {
    if (attempt === 1) {
      fixture.summary([packages[0]])
      return { status: 1, stdout: '', stderr: 'HTTP 503' }
    }
    fixture.summary([packages[1]])
    return { status: 0, stdout: '', stderr: '' }
  })
  fixture.sleep.mockImplementation(async () => {
    expect(fixture.github.ensureTag).not.toHaveBeenCalled()
    expect(fixture.github.ensureRelease).not.toHaveBeenCalled()
    expect(fixture.hooks).toEqual(['quality', 'before'])
    if (fixture.publishes.length === 2) {
      packages.forEach(pkg => fixture.visible.add(pkg.name))
    }
  })

  expect(await fixture.runCi()).toEqual(packages)
  expect(fixture.publishes).toHaveLength(2)
  expect(fixture.github.ensureTag).toHaveBeenCalledTimes(packages.length)
  expect(fixture.github.ensureRelease).toHaveBeenCalledTimes(packages.length)
  expect(fixture.hooks).toEqual(['quality', 'before', 'after'])
  expect(fixture.hookVisibility.at(-1)).toEqual(packages.map(pkg => pkg.name))
  expect(await fixture.progress()).toMatchObject({ status: 'complete', confirmedPackages: packages })
})

it('does not run metadata or post-publish hooks when visibility confirmation times out', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const fixture = await createReleaseFixture()
  fixture.setPublish(() => {
    fixture.summary()
    return { status: 0, stdout: '', stderr: '' }
  })

  await expect(fixture.runCi()).rejects.toThrow(/visibility confirmation timed out/)
  expect(fixture.publishes).toHaveLength(1)
  expect(fixture.github.ensureTag).not.toHaveBeenCalled()
  expect(fixture.github.ensureRelease).not.toHaveBeenCalled()
  expect(fixture.hooks).toEqual(['quality', 'before'])
  expect(await fixture.progress()).toMatchObject({
    status: 'failed',
    acceptedPackages: packages,
    confirmedPackages: [],
  })
})
