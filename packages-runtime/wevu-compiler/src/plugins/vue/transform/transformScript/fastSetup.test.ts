import { describe, expect, it } from 'vitest'
import { transformScript } from './index'

const compiledScriptSetupSource = `import { defineComponent as _defineComponent } from 'vue'
import { createSharedLabel } from '../../shared/tokens'

const scriptMarker = 'SFC_SCRIPT_MARKER'

export default /*@__PURE__*/_defineComponent({
  __name: 'index',
  setup(__props, { expose: __expose }) {
  __expose();

const shared = createSharedLabel('sfc-page')

const __returned__ = { scriptMarker, shared }
Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })
return __returned__
}

})`

describe('transformScript fast compiled script setup path', () => {
  it('rewrites standard compileScript output without Babel generation when sourcemap is disabled', () => {
    const result = transformScript(compiledScriptSetupSource, {
      isPage: true,
      sourceMap: false,
    })

    expect(result.map).toBeNull()
    expect(result.transformed).toBe(true)
    expect(result.code).toContain('createWevuComponent(__wevuOptions)')
    expect(result.code).toContain('__wevu_isPage: true')
    expect(result.code).toContain('export default __wevuOptions')
    expect(result.code).not.toContain('from \'vue\'')
    expect(result.code).not.toContain('__isScriptSetup')
    expect(result.code).not.toContain('__expose')
  })

  it('falls back to the Babel path when template metadata injection is needed', () => {
    const result = transformScript(compiledScriptSetupSource, {
      isPage: true,
      sourceMap: false,
      inlineExpressions: [
        {
          id: 'expr-0',
          expression: 'scriptMarker',
          scopeKeys: [],
        },
      ],
    })

    expect(result.code).toContain('__weapp_vite_inline_map')
    expect(result.code).not.toContain('Object.defineProperty(__returned__')
  })

  it('allows empty wevu defaults but falls back when defaults need injection', () => {
    const emptyDefaults = transformScript(compiledScriptSetupSource, {
      isPage: true,
      sourceMap: false,
      wevuDefaults: {},
    })

    expect(emptyDefaults.map).toBeNull()
    expect(emptyDefaults.code).not.toContain('__isScriptSetup')

    const defaultsInjected = transformScript(compiledScriptSetupSource, {
      isPage: true,
      sourceMap: false,
      wevuDefaults: {
        component: {
          setData: {
            strategy: 'patch',
          },
        },
      },
    })

    expect(defaultsInjected.code).toContain('setData: { strategy: "patch" }')
    expect(defaultsInjected.code).not.toContain('Object.defineProperty(__returned__')
  })

  it('keeps default sourcemap behavior on the Babel path', () => {
    const result = transformScript(compiledScriptSetupSource, {
      isPage: true,
    })

    expect(result.map).toBeTruthy()
    expect(result.code).toContain('createWevuComponent(__wevuOptions)')
  })
})
