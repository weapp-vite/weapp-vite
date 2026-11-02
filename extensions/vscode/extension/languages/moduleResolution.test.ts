import { realpathSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
    const resolved = new URL(resolveProjectImport('language-format-fixture/project', root))
    // ESM 解析可能保留 Windows 短路径；按原生真实路径验证同一个 import 条件文件。
    expect(resolved.protocol).toBe('file:')
    expect(resolved.search).toBe('')
    expect(resolved.hash).toBe('')
    expect(realpathSync.native(fileURLToPath(resolved))).toBe(realpathSync.native(path.join(packageRoot, 'import.mjs')))
    expect(() => resolveProjectImport('missing-language-format/project', root)).toThrow()
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
