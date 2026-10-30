import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import { resolveProjectImport } from './moduleResolution'

it('resolves import-only project exports with the project parent URL', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'language-import-'))
  try {
    const packageRoot = path.join(root, 'node_modules', 'language-format-fixture')
    await fs.mkdir(packageRoot, { recursive: true })
    await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
      name: 'language-format-fixture',
      type: 'module',
      exports: { './project': { import: './import.mjs' } },
    }))
    await fs.writeFile(path.join(packageRoot, 'import.mjs'), 'export const value = true\n')
    expect(resolveProjectImport('language-format-fixture/project', root)).toBe(pathToFileURL(await fs.realpath(path.join(packageRoot, 'import.mjs'))).href)
    expect(() => resolveProjectImport('missing-language-format/project', root)).toThrow()
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
