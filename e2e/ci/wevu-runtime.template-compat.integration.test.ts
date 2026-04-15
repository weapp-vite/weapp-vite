import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { DIST_ROOT, runBuild } from '../wevu-runtime.utils'

describe.sequential('wevu runtime template compat integration', () => {
  it('compiles v-else-if and v-for destructure variants', async () => {
    await runBuild('weapp')

    const pageBase = path.join(DIST_ROOT, 'pages/template-compat/index')
    const wxml = await fs.readFile(`${pageBase}.wxml`, 'utf8')
    const script = await fs.readFile(`${pageBase}.js`, 'utf8')

    expect(wxml).toContain(`wx:elif="{{branch === 'elseIf'}}"`)

    expect(wxml).toContain(`wx:for="{{entries}}"`)
    const tupleItemMatch = wxml.match(/\{\{(__wv_item_\d+)\[0\]\}\} = \{\{\1\[1\]\}\}/)
    expect(tupleItemMatch).not.toBeNull()

    expect(wxml).toContain(`wx:for="{{entryObjects}}"`)
    const objectItemMatch = wxml.match(/\{\{(__wv_item_\d+)\.key\}\} = \{\{\1\.value\}\}/)
    expect(objectItemMatch).not.toBeNull()

    expect(wxml).toContain(`wx:for="{{summaryMap}}"`)
    expect(wxml).toContain(`wx:for-item="value" wx:for-index="key"`)

    expect(wxml).not.toContain(`.  = `)
    expect(script).toMatch(/Object\.fromEntries/)
  })
})
