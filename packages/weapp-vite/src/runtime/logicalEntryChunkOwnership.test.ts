import type { ConfigService } from './config/types'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createLogicalEntryId } from '../moduleGraph/protocol'
import { createAdvancedChunkNameResolver } from './advancedChunks'
import { resolvePreservedModuleName } from './preserveModules'

describe('logical entry physical chunk ownership', () => {
  it.each(['shared', 'preserved'] as const)('keeps a junction-resolved component in its logical facade instead of a second %s chunk', async (mode) => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'logical-entry-chunk-'))
    try {
      const project = path.join(temporaryRoot, 'project')
      await mkdir(path.join(project, 'src/components'), { recursive: true })
      await writeFile(path.join(project, 'src/components/SharedCard.vue'), '<template><view /></template>')
      const workspace = path.join(temporaryRoot, 'workspace')
      await symlink(project, workspace, 'junction')
      const srcRoot = path.join(workspace, 'src')
      const sourceId = path.join(srcRoot, 'components/SharedCard.vue')
      const logicalId = createLogicalEntryId(sourceId, 'component')
      const pageId = path.join(srcRoot, 'pages/index.ts')
      const ctx = { getModuleInfo: (id: string) => ({ importers: id === sourceId ? [logicalId, pageId] : [] }) }
      const relativeAbsoluteSrcRoot = (id: string) => path.relative(srcRoot, id)
      const name = mode === 'shared'
        ? createAdvancedChunkNameResolver({
            relativeAbsoluteSrcRoot,
            vendorsMatchers: [],
            getSubPackageRoots: () => [],
            strategy: 'hoist',
            sharedMode: 'path',
            resolveSharedPath: () => 'components/SharedCard.vue',
          })(sourceId, ctx)
        : resolvePreservedModuleName({
            configService: { absoluteSrcRoot: srcRoot, relativeAbsoluteSrcRoot } as ConfigService,
            ctx,
            getSubPackageRoots: () => [],
            id: sourceId,
          })
      expect(name).toBeUndefined()
    }
    finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })
})
