import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { classifyOwnedModule, createModuleOwnerResolver } from './owner'

describe('module package ownership', () => {
  it('reads nearest package identity through nested ESM boundaries without escaping node_modules', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'analyze-owner-'))
    try {
      const moduleRoot = path.join(root, 'node_modules/.pnpm/wevu@7.4.0/node_modules/wevu')
      await mkdir(path.join(moduleRoot, 'dist'), { recursive: true })
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'application' }))
      await writeFile(path.join(moduleRoot, 'package.json'), JSON.stringify({ name: 'wevu', version: '7.4.0' }))
      await writeFile(path.join(moduleRoot, 'dist/package.json'), JSON.stringify({ type: 'module' }))
      const resolve = createModuleOwnerResolver()
      expect(resolve(path.join(moduleRoot, 'dist/runtime.mjs?import'))).toEqual({ name: 'wevu', version: '7.4.0' })
      expect(resolve(path.join(root, 'node_modules/unknown/index.js'))).toBeUndefined()
      expect(resolve('\0rolldown/runtime.js')).toEqual({ name: 'rolldown' })
      expect(classifyOwnedModule({ name: 'wevu' }, true)).toBe('application')
      expect(classifyOwnedModule({ name: 'business-wevu' }, false)).toBe('dependency')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
