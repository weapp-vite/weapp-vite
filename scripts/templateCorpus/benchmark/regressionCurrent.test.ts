import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { regressionProductionFiles } from './regressionCurrent'

it('inventories nested production modules and assets without dropping future source extensions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'regression-source-inventory-'))
  try {
    await mkdir(path.join(directory, 'nested'))
    const files = ['index.ts', 'nested/dialect.tsx', 'nested/data.json', 'nested/dialect.test.ts', 'index.spec.js']
    for (const file of files) {
      await writeFile(path.join(directory, file), file)
    }
    const relative = async () => (await regressionProductionFiles(directory)).map(file => path.relative(directory, file).replaceAll('\\', '/'))
    expect(await relative()).toEqual(['index.ts', 'nested/data.json', 'nested/dialect.tsx'])
    await writeFile(path.join(directory, 'new-module.mts'), 'new production source')
    expect(await relative()).toContain('new-module.mts')
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
