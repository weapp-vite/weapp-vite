import { lstat, mkdir, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createIssue963Project } from './issue963Project'

it('creates a local dependency directory with direct package targets and writable npm cache', async () => {
  const project = await createIssue963Project(false)
  try {
    const modules = path.join(project, 'node_modules')
    expect((await lstat(modules)).isDirectory()).toBe(true)
    expect((await lstat(modules)).isSymbolicLink()).toBe(false)
    for (const [name, source] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']]) {
      expect(await realpath(path.join(modules, name))).toBe(await realpath(path.resolve(import.meta.dirname, '../..', source)))
    }
    for (const name of ['dayjs', 'sass']) {
      expect((await lstat(await realpath(path.join(modules, name)))).isDirectory()).toBe(true)
    }
    const cache = path.join(modules, 'weapp-vite/.cache')
    await mkdir(cache, { recursive: true })
    expect((await lstat(cache)).isDirectory()).toBe(true)
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})
