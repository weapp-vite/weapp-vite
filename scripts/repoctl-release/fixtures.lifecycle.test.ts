import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { cleanupReleaseFixtures, withReleaseFixture } from './fixtures'

afterEach(cleanupReleaseFixtures)

it('keeps the directory until the entire cancelled fixture body exits', async ({ signal }) => {
  let enter!: (root: string) => void
  const entered = new Promise<string>((resolve) => {
    enter = resolve
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const work = withReleaseFixture(signal, async (fixture) => {
    enter(fixture.cwd)
    await gate
    // 已排队的测试续体仍可写文件，清理必须等完整工作链退出。
    await writeFile(path.join(fixture.cwd, 'late.json'), '{}')
    await fixture.runStage('plan')
  })
  const rejected = expect(work).rejects.toThrow('Fixture is closing')
  const root = await entered
  const cleanup = cleanupReleaseFixtures()
  try {
    await expect(access(root)).resolves.toBeUndefined()
  }
  finally {
    release()
  }
  await rejected
  await cleanup
  await expect(access(root)).rejects.toMatchObject({ code: 'ENOENT' })
  await cleanupReleaseFixtures()
})
