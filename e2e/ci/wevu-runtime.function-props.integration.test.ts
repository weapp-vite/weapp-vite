import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { DIST_ROOT, runBuild } from '../wevu-runtime.utils'

const FUNCTION_PROP_BINDING_RE = /handler="\{\{__wv_bind_\d+\}\}"/
const FUNCTION_PROP_METADATA_RE = /__wevuFunctionPropPaths:\s*\[\s*"callback",\s*"__wv_bind_\d+"\s*\]/

describe.sequential('wevu runtime function props integration', () => {
  it('emits compiler metadata for auto function prop paths and preserves opt-out', async () => {
    await runBuild('weapp')

    const autoBase = path.join(DIST_ROOT, 'pages/function-props-auto/index')
    const disabledBase = path.join(DIST_ROOT, 'pages/function-props-disabled/index')
    const dynamicBase = path.join(DIST_ROOT, 'pages/function-props-dynamic/index')
    const autoWxml = await fs.readFile(`${autoBase}.wxml`, 'utf8')
    const autoScript = await fs.readFile(`${autoBase}.js`, 'utf8')
    const disabledWxml = await fs.readFile(`${disabledBase}.wxml`, 'utf8')
    const disabledScript = await fs.readFile(`${disabledBase}.js`, 'utf8')
    const dynamicWxml = await fs.readFile(`${dynamicBase}.wxml`, 'utf8')
    const dynamicScript = await fs.readFile(`${dynamicBase}.js`, 'utf8')

    expect(autoWxml).toContain('<x-function-prop-child')
    expect(autoWxml).toContain('callback="{{callback}}"')
    expect(autoWxml).toMatch(FUNCTION_PROP_BINDING_RE)
    expect(autoScript).toContain('__wevuFunctionPropPaths')
    expect(autoScript).toContain('"callback"')
    expect(autoScript).toMatch(FUNCTION_PROP_METADATA_RE)
    expect(autoScript).toContain('handlers')
    expect(autoScript).toContain('.save')

    expect(disabledWxml).toContain('<x-function-prop-child')
    expect(disabledWxml).toContain('callback="{{callback}}"')
    expect(disabledWxml).toMatch(FUNCTION_PROP_BINDING_RE)
    expect(disabledScript).toContain('allowFunctionProps: false')
    expect(disabledScript).toContain('__wevuFunctionPropPaths')
    expect(disabledScript).toContain('"callback"')
    expect(disabledScript).toMatch(FUNCTION_PROP_METADATA_RE)

    expect(dynamicWxml).toContain('<x-function-prop-child')
    expect(dynamicWxml).toMatch(FUNCTION_PROP_BINDING_RE)
    expect(dynamicScript).toContain('allowFunctionProps: true')
    expect(dynamicScript).not.toContain('__wevuFunctionPropPaths')
    expect(dynamicScript).toContain('callbacks')
    expect(dynamicScript).toContain('currentKey')
  })
})
