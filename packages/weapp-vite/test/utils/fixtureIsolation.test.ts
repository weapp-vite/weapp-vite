import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createTempFixtureProject } from '../utils'

it('isolates concurrent copies and only removes the instance it owns', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'fixture-owner-'))
  try {
    const source = path.join(root, 'source')
    await mkdir(path.join(source, 'src'), { recursive: true })
    await writeFile(path.join(source, 'src/index.ts'), 'export const value = "source"\n')
    await writeFile(path.join(source, 'tsconfig.json'), '{"extends":"./.weapp-vite/tsconfig.app.json"}')
    const [first, second] = await Promise.all([
      createTempFixtureProject(source, 'first'),
      createTempFixtureProject(source, 'second'),
    ])
    try {
      expect(first.tempDir).not.toBe(second.tempDir)
      await writeFile(path.join(first.tempDir, 'src/index.ts'), 'changed first copy\n')
      const cleaning = first.cleanup()
      expect(first.cleanup()).toBe(cleaning)
      await cleaning
      await first.cleanup()
      expect(await readFile(path.join(second.tempDir, 'src/index.ts'), 'utf8')).toContain('source')
      expect(await readFile(path.join(source, 'src/index.ts'), 'utf8')).toContain('source')
      expect(JSON.parse(await readFile(path.join(second.tempDir, '.weapp-vite/tsconfig.app.json'), 'utf8'))).toHaveProperty('extends', './tsconfig.shared.json')
    }
    finally {
      await Promise.all([first.cleanup(), second.cleanup()])
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
