import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it } from 'vitest'
import { writeStatefulHmrOutput } from './outputWriter'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(root => fs.remove(root)))
})

describe('stateful hmr output writer', () => {
  it('persists generated files through Vite write without deleting partial output', async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), '.tmp-stateful-hmr-writer-'))
    tempRoots.push(root)
    const outDir = path.join(root, 'dist')
    await fs.outputFile(path.join(outDir, 'keep.js'), 'keep')

    await writeStatefulHmrOutput(outDir, [
      { type: 'asset', fileName: 'app.js', source: 'App({})' },
      { type: 'asset', fileName: '__weapp_vite_hmr/update.js', source: 'void 0;' },
    ])

    await expect(fs.readFile(path.join(outDir, 'app.js'), 'utf8')).resolves.toBe('App({})')
    await expect(fs.readFile(path.join(outDir, '__weapp_vite_hmr/update.js'), 'utf8')).resolves.toBe('void 0;')
    await expect(fs.readFile(path.join(outDir, 'keep.js'), 'utf8')).resolves.toBe('keep')
  })
})
