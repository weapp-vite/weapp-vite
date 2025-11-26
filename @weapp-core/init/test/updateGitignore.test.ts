import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultGitignore } from '@/gitignore'
import { updateGitIgnore } from '@/updateGitignore'
import * as fsUtils from '@/utils/fs'

describe('updateGitignore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates .gitignore with default content when missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-gitignore-'))
    const merged = await updateGitIgnore({ root })
    const content = await fs.readFile(path.join(root, '.gitignore'), 'utf8')

    expect(merged).toBe(content)
    expect(content).toContain('node_modules')
    expect(content.endsWith('\n')).toBe(true)
  })

  it('skips writing when content is unchanged and honors dest path', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-gitignore-dest-'))
    const dest = path.join(root, 'custom/.gitignore')
    const defaultContent = getDefaultGitignore()
    const normalizedDefault = defaultContent.endsWith('\n') ? defaultContent : `${defaultContent}\n`
    await fs.outputFile(dest, normalizedDefault)

    const writeSpy = vi.spyOn(fsUtils, 'writeFile')
    const merged = await updateGitIgnore({ root, dest: 'custom/.gitignore' })

    expect(merged).toBe(normalizedDefault)
    expect(writeSpy).not.toHaveBeenCalled()
  })
})
