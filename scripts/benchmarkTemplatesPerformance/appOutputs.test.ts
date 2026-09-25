import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { verifyBenchmarkAppOutputs } from './appOutputs'

it('checks main and independent pages and rejects successful builds with missing artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'benchmark-output-'))
  try {
    await mkdir(path.join(root, 'dist/sub'), { recursive: true })
    await writeFile(path.join(root, 'dist/app.json'), JSON.stringify({ pages: ['index'], subPackages: [{ root: 'sub', pages: ['index'], independent: true }] }))
    for (const page of ['index', 'sub/index']) {
      await writeFile(path.join(root, `dist/${page}.js`), 'Page({})')
      await writeFile(path.join(root, `dist/${page}.wxml`), '')
    }
    expect(await verifyBenchmarkAppOutputs(root)).toMatchObject({ pageCount: 2, sha256: expect.any(String) })
    await rm(path.join(root, 'dist/sub/index.wxml'))
    await expect(verifyBenchmarkAppOutputs(root)).rejects.toThrow('index.wxml')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
