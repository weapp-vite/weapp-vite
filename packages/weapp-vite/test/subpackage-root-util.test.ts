import type { CompilerContext } from '@/context'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompilerContext } from '@/createContext'
import { getFixture, scanFiles } from './utils'

describe('subpackage root util fixture', () => {
  const cwd = getFixture('subpackage-root-util')
  const outDir = path.resolve(cwd, 'dist')

  let ctx: CompilerContext | undefined

  afterEach(async () => {
    try {
      await ctx?.watcherService?.closeAll()
    }
    finally {
      ctx = undefined
      await fs.remove(outDir)
    }
  })

  it('keeps root-level utilities inside the consuming subpackage only', async () => {
    await fs.remove(outDir)

    ctx = await createCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
          outDir: 'dist',
        },
      },
    })

    await ctx.buildService.build()

    const files = await scanFiles(outDir)
    expect(files).toContain('app.js')
    expect(files.some(file => file.startsWith('packageA/'))).toBe(true)

    const sentinel = 'root-only-util'
    const appCode = await fs.readFile(path.join(outDir, 'app.js'), 'utf8')
    expect(appCode).not.toContain(sentinel)

    const sentinelFiles: string[] = []
    for (const file of files) {
      if (!file.endsWith('.js')) {
        continue
      }
      const content = await fs.readFile(path.resolve(outDir, file), 'utf8')
      if (content.includes(sentinel)) {
        sentinelFiles.push(file)
      }
    }

    expect(sentinelFiles.length).toBeGreaterThan(0)
    expect(sentinelFiles.every(file => file.startsWith('packageA/'))).toBe(true)
    expect(sentinelFiles).not.toContain('app.js')
  })
})
