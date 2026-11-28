import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 通过 mock 验证 Windows 注销后删除失败的清理回退。
import { execa } from 'execa'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanupPushSnapshot } from './snapshot.ts'

vi.mock('execa', () => ({ execa: vi.fn() }))

const roots = new Set<string>()
afterEach(async () => {
  vi.mocked(execa).mockReset()
  await Promise.all([...roots].map(async (root) => {
    await rm(root, { recursive: true, force: true })
    roots.delete(root)
  }))
})

it('removes task files when git unregisters before a Windows deletion failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'push-snapshot-cleanup-'))
  roots.add(root)
  const owned = path.join(root, 'candidate-test')
  const directory = path.join(owned, 'workspace')
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'source.ts'), 'export const value = 1\n')

  vi.mocked(execa)
    .mockResolvedValueOnce({ stdout: `worktree ${directory}\nHEAD fixture\n\0` } as unknown as Awaited<ReturnType<typeof execa>>)
    .mockRejectedValueOnce(new Error('Result too large'))
    .mockResolvedValueOnce({ stdout: '\0' } as unknown as Awaited<ReturnType<typeof execa>>)

  await expect(cleanupPushSnapshot({ root, owned, directory, attached: true, env: {} })).resolves.toBeUndefined()
  await expect(access(directory)).rejects.toMatchObject({ code: 'ENOENT' })
})
