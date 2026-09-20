import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { scan } from 'rolldown/experimental'
import { expect, it } from 'vitest'
import simulatorConfig from '../../mpcore/packages/simulator/vitest.e2e.config'

it('scans simulator dependencies without loading unrelated app project references', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'simulator-dependency-scan-')))
  try {
    await fs.mkdir(path.join(root, 'unused-app'))
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      references: [{ path: './unused-app' }],
      files: [],
    }))
    await fs.writeFile(path.join(root, 'unused-app/tsconfig.json'), JSON.stringify({
      extends: './.weapp-vite/tsconfig.shared.json',
    }))
    const entry = path.join(root, 'entry.ts')
    const dependency = path.join(root, 'dependency.ts')
    await fs.writeFile(entry, 'export { value } from "./dependency"')
    await fs.writeFile(dependency, 'export const value: number = 42')

    await expect(scan({ cwd: root, input: entry, logLevel: 'silent' }))
      .rejects
      .toThrow('TSCONFIG_ERROR')

    const scanned: string[] = []
    await scan({
      ...simulatorConfig.optimizeDeps?.rolldownOptions,
      cwd: root,
      input: entry,
      logLevel: 'silent',
      plugins: [{
        name: 'record-scanned-modules',
        load(id) {
          scanned.push(path.resolve(id))
        },
      }],
    })
    expect(scanned).toEqual(expect.arrayContaining([entry, dependency]))
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
