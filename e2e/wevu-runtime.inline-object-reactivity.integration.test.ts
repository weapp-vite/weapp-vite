import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { DIST_ROOT, runBuild } from './wevu-runtime.utils'

describe.sequential('wevu runtime inline object reactivity integration', () => {
  it('emits identity restore metadata for v-for inline object params', async () => {
    await runBuild('weapp')

    const pageBase = path.join(DIST_ROOT, 'pages/wevu-inline-object-reactivity-repro/index')
    const wxml = await fs.readFile(`${pageBase}.wxml`, 'utf8')
    const script = await fs.readFile(`${pageBase}.js`, 'utf8')

    expect(wxml).toContain('data-wv-inline-id="__wv_inline_0"')
    expect(wxml).toMatch(/data-wv-i0="\{\{[^}]+\}\}"/)
    expect(script).toContain('scopeResolvers')
    expect(script).toContain('indexKeys')
  })
})
