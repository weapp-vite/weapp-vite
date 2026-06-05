import os from 'node:os'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolveProjectSrcRoot } from '@/projectLayout'

describe('projectLayout', () => {
  it('uses project config miniprogram root when it contains app.json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-layout-miniprogram-'))
    await fs.outputJSON(path.join(root, 'miniprogram/app.json'), { pages: [] })

    await expect(resolveProjectSrcRoot(root, {
      miniprogramRoot: 'miniprogram/',
      setting: {
        packNpmManually: false,
        packNpmRelationList: [],
      },
    })).resolves.toBe('miniprogram')
  })

  it('uses project root for native js projects with app.json at root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-layout-root-'))
    await fs.outputJSON(path.join(root, 'app.json'), { pages: [] })

    await expect(resolveProjectSrcRoot(root, {
      setting: {
        packNpmManually: false,
        packNpmRelationList: [],
      },
    })).resolves.toBe('.')
  })

  it('normalizes slash-only project config roots to project root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-layout-slash-root-'))
    await fs.outputJSON(path.join(root, 'app.json'), { pages: [] })

    await expect(resolveProjectSrcRoot(root, {
      miniprogramRoot: './',
      setting: {
        packNpmManually: false,
        packNpmRelationList: [],
      },
    })).resolves.toBe('.')
  })

  it('falls back to src for empty projects', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-layout-empty-'))

    await expect(resolveProjectSrcRoot(root, null)).resolves.toBe('src')
  })
})
