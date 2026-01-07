import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('client.d.ts', () => {
  it('types defineOptions options with WechatMiniprogram.Component.ComponentOptions', async () => {
    const filePath = path.resolve(__dirname, '../client.d.ts')
    const content = await readFile(filePath, 'utf8')

    expect(content).toContain('options?: WechatMiniprogram.Component.ComponentOptions')
    expect(content).not.toContain('MiniProgramComponentOptions')
  })
})
