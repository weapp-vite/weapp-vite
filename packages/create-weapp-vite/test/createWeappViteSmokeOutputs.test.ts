import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { distHasRequiredOutputs } from '../../../scripts/createWeappViteSmoke/runtime.mjs'
import { resolveMiniProgramDirectory } from '../../../scripts/createWeappViteSmoke/templates.mjs'

describe('scaffold smoke output discovery', () => {
  it.each([
    ['default', '.', 'dist/'],
    ['multi-platform', 'dist/weapp', 'dist'],
    ['multi-platform-sfc', 'dist/weapp', 'custom-output'],
    ['multi-platform', 'dist/weapp', '.'],
  ])('follows the IDE miniprogramRoot for %s (%s/%s)', async (template, projectRoot, outputRoot) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-smoke-outputs-'))
    try {
      const ideRoot = path.join(root, projectRoot)
      const output = path.resolve(ideRoot, outputRoot)
      expect(await distHasRequiredOutputs(root, template)).toBe(false)
      await fs.mkdir(output, { recursive: true })
      await fs.writeFile(path.join(ideRoot, 'project.config.json'), JSON.stringify({ miniprogramRoot: outputRoot }))
      expect(await resolveMiniProgramDirectory(root, template)).toBe(output)
      await fs.writeFile(path.join(output, 'app.json'), '{}')
      expect(await distHasRequiredOutputs(root, template)).toBe(false)
      await fs.writeFile(path.join(output, 'app.js'), 'App({})')
      expect(await distHasRequiredOutputs(root, template)).toBe(true)
    }
    finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
