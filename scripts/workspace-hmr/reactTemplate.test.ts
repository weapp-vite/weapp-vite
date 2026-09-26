import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isDynamicReactTemplateOutput } from './reactTemplate'

const tempDirectories: string[] = []

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'workspace-hmr-react-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('React HMR template discovery', () => {
  it('allows missing output only before the first build', async () => {
    const filename = path.join(await createTemporaryDirectory(), 'index.wxml')
    await expect(isDynamicReactTemplateOutput(filename, false)).resolves.toBe(false)
    await expect(isDynamicReactTemplateOutput(filename, true)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reads actual generated template mode after output is written', async () => {
    const filename = path.join(await createTemporaryDirectory(), 'index.wxml')
    await writeFile(filename, '<view>{{count}}</view>')
    await expect(isDynamicReactTemplateOutput(filename, true)).resolves.toBe(false)
    await writeFile(filename, '<template is="react_root" data="{{root:root}}" />')
    await expect(isDynamicReactTemplateOutput(filename, true)).resolves.toBe(true)
  })

  it('does not mistake unreadable output for a static template', async () => {
    const directory = await createTemporaryDirectory()
    await expect(isDynamicReactTemplateOutput(directory, false)).rejects.toBeInstanceOf(Error)
    await expect(isDynamicReactTemplateOutput(directory, true)).rejects.toBeInstanceOf(Error)
  })
})
