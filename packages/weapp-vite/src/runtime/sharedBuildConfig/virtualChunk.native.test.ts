import type { OutputChunk } from 'rolldown'
import { Buffer } from 'node:buffer'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createTestCompilerContext, getFixture } from '../../../test/utils'
import { parseLogicalEntryId } from '../../moduleGraph/protocol'

it('writes lib facades and their implementation chunks from a deeply nested checkout', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'virtual-chunk-output-'))
  const cwd = path.join(temporary, ...Array.from({ length: 12 }).fill('nested-project'))
  const chunks: Pick<OutputChunk, 'fileName' | 'facadeModuleId' | 'moduleIds'>[] = []
  let dispose: (() => Promise<void>) | undefined
  try {
    await mkdir(cwd, { recursive: true })
    await cp(path.join(getFixture('lib-mode'), 'src'), path.join(cwd, 'src'), { recursive: true })
    await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ name: 'deep-lib-output', type: 'module' }))
    await symlink(path.resolve(import.meta.dirname, '../../../../..', 'node_modules'), path.join(cwd, 'node_modules'), 'junction')
    const fixture = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        weapp: {
          lib: {
            entry: { 'button': 'components/button/index.ts', 'components/button/index': 'components/button/index.ts' },
            root: 'src',
            fileName: 'lib/[name]',
            componentJson: 'auto',
            dts: false,
          },
        },
        build: { minify: false, outDir: 'dist' },
        plugins: [{
          name: 'capture-deep-lib-chunks',
          generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
              if (output.type === 'chunk') {
                chunks.push({ fileName: output.fileName, facadeModuleId: output.facadeModuleId, moduleIds: output.moduleIds })
              }
            }
          },
        }],
      },
    })
    dispose = fixture.dispose
    await fixture.ctx.buildService.build()
    expect(chunks.some(chunk => chunk.fileName === 'lib/button.js')).toBe(true)
    expect(chunks.some(chunk => chunk.fileName === 'lib/components/button/index.js')).toBe(true)
    expect(chunks.some(chunk => chunk.facadeModuleId === null && chunk.moduleIds.some(id => parseLogicalEntryId(id)))).toBe(true)
    for (const chunk of chunks) {
      expect(Buffer.byteLength(path.basename(chunk.fileName)), JSON.stringify(chunk)).toBeLessThanOrEqual(255)
    }
    for (const chunk of chunks) {
      expect(await readFile(path.join(cwd, 'dist', chunk.fileName), 'utf8')).not.toBe('')
    }
  }
  finally {
    try {
      await dispose?.()
    }
    finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }
})
