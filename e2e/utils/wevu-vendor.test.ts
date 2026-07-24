import os from 'node:os'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { waitForWevuSharedRuntimeChunkContaining } from './wevu-vendor'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(tempRoot => fs.remove(tempRoot)))
})

describe('wevu vendor helpers', () => {
  it('waits for a shared chunk instead of returning an intermediate page output', async () => {
    const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-wevu-vendor-'))
    tempRoots.push(distRoot)
    const marker = 'SHARED-RUNTIME-CONVERGENCE'
    await fs.outputFile(
      path.join(distRoot, 'pages/store/index.js'),
      `const pageMarker = "${marker}";`,
    )

    const pendingChunk = waitForWevuSharedRuntimeChunkContaining(distRoot, [marker], 2_000)
    await new Promise(resolve => setTimeout(resolve, 50))
    await fs.outputFile(
      path.join(distRoot, 'common.js'),
      `const sharedMarker = "${marker}";`,
    )

    const chunk = await pendingChunk
    expect(path.relative(distRoot, chunk.path).replaceAll('\\', '/')).toBe('common.js')
  })
})
