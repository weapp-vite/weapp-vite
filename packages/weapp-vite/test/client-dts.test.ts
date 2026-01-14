import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('defineOptions typing', () => {
  it('is declared in wevu instead of weapp-vite client.d.ts', async () => {
    const clientPath = path.resolve(__dirname, '../client.d.ts')
    const wevuPath = path.resolve(__dirname, '../../wevu/src/macros.ts')
    const [clientContent, wevuContent] = await Promise.all([
      readFile(clientPath, 'utf8'),
      readFile(wevuPath, 'utf8'),
    ])

    expect(clientContent).not.toContain('ComponentCustomOptions')
    expect(wevuContent).toContain('options?: WechatMiniprogram.Component.ComponentOptions')
  })
})
