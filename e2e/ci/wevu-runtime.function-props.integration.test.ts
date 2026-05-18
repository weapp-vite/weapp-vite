import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { DIST_ROOT, runBuild } from '../wevu-runtime.utils'

describe.sequential('wevu runtime function props integration', () => {
  it('emits compiler metadata for auto function prop paths and preserves opt-out', async () => {
    await runBuild('weapp')

    const autoBase = path.join(DIST_ROOT, 'pages/function-props-auto/index')
    const disabledBase = path.join(DIST_ROOT, 'pages/function-props-disabled/index')
    const autoWxml = await fs.readFile(`${autoBase}.wxml`, 'utf8')
    const autoScript = await fs.readFile(`${autoBase}.js`, 'utf8')
    const disabledWxml = await fs.readFile(`${disabledBase}.wxml`, 'utf8')
    const disabledScript = await fs.readFile(`${disabledBase}.js`, 'utf8')

    expect(autoWxml).toContain('<x-function-prop-child')
    expect(autoWxml).toContain('callback="{{callback}}"')
    expect(autoScript).toContain('__wevuFunctionPropPaths')
    expect(autoScript).toContain('"callback"')

    expect(disabledWxml).toContain('<x-function-prop-child')
    expect(disabledWxml).toContain('callback="{{callback}}"')
    expect(disabledScript).toContain('allowFunctionProps: false')
    expect(disabledScript).toContain('__wevuFunctionPropPaths')
    expect(disabledScript).toContain('"callback"')
  })
})
