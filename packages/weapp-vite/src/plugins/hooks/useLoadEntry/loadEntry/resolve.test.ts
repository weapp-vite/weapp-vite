import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntryResolver } from './resolve'

const TEMP_ROOT = path.resolve(import.meta.dirname, '../../../../test/__temp__')

async function cleanupTempRoot() {
  if (!await fs.pathExists(TEMP_ROOT)) {
    return
  }

  const entries = await fs.readdir(TEMP_ROOT)
  if (entries.length === 0) {
    await fs.remove(TEMP_ROOT)
  }
}

describe('createEntryResolver', () => {
  afterEach(async () => {
    await cleanupTempRoot()
  })

  it('falls back to the existing absolute entry path when plugin resolve misses a new file', async () => {
    await fs.ensureDir(TEMP_ROOT)
    const tempDir = await fs.mkdtemp(path.join(TEMP_ROOT, 'load-entry-resolve-'))
    const entryPath = path.join(tempDir, 'components/HotCard/index.vue')
    await fs.ensureDir(path.dirname(entryPath))
    await fs.writeFile(entryPath, '<template><view>hot</view></template>', 'utf8')

    try {
      const resolver = createEntryResolver({ isDev: true })
      const pluginCtx = {
        resolve: async () => null,
      } as any

      await expect(resolver.resolveEntryWithCache(pluginCtx, entryPath)).resolves.toEqual({
        id: entryPath,
      })
    }
    finally {
      await fs.remove(tempDir)
    }
  })

  it('keeps null when the unresolved absolute entry does not exist', async () => {
    const entryPath = '/project/src/components/MissingCard/index.vue'
    const resolver = createEntryResolver({ isDev: true })
    const pluginCtx = {
      resolve: async () => null,
    } as any

    await expect(resolver.resolveEntryWithCache(pluginCtx, entryPath)).resolves.toBeNull()
  })
})
