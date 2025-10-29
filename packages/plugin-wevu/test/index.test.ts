import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { compileWevuSfc } from '@/compiler'

const fixturesRoot = path.resolve(import.meta.dirname, './fixtures')
const case0Path = path.resolve(fixturesRoot, 'case0.vue')
const outputRoot = path.resolve(fixturesRoot, 'output')

describe('compileWevuSfc', () => {
  it('extracts blocks and transforms script', async () => {
    const result = await compileWevuSfc({ filename: case0Path })

    expect(result.script?.lang).toBe('ts')
    const expectedScript = await fs.readFile(path.resolve(outputRoot, 'case0.ts'), 'utf8')
    expect(result.script?.code.trim()).toBe(expectedScript.trim())

    const expectedTemplate = await fs.readFile(path.resolve(outputRoot, 'case0.wxml'), 'utf8')
    expect(result.template?.code.trim()).toBe(expectedTemplate.trim())

    const expectedStyle = await fs.readFile(path.resolve(outputRoot, 'case0.wxss'), 'utf8')
    expect(result.style?.code.trim()).toBe(expectedStyle.trim())
    expect(result.style?.lang).toBe('wxss')

    const expectedConfig = await fs.readFile(path.resolve(outputRoot, 'case0.json'), 'utf8')
    expect(result.config?.code.trim()).toBe(expectedConfig.trim())
  })
})
