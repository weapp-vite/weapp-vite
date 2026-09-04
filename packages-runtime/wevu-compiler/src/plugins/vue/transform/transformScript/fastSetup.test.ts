import { WEVU_SLOT_OWNER_ID_PROP } from '@weapp-core/constants'
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

const compiledDefineExposeSource = compiledScriptSetupSource
  .replace('__expose();', '__expose({ runE2E });')
  .replace(`const scriptMarker = 'SFC_SCRIPT_MARKER'`, `const scriptMarker = 'SFC_SCRIPT_MARKER'\nconst runE2E = () => scriptMarker`)

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

  it('marks compiled components as non-page on the fast path', () => {
    const result = transformScript(compiledScriptSetupSource, {
      isPage: false,
      sourceMap: false,
    })

    expect(result.code).toContain('__wevu_isPage: false')
  })

  it('rewrites defineExpose calls with arguments on the fast path', () => {
    const result = transformScript(compiledDefineExposeSource, {
      isPage: true,
      sourceMap: false,
    })

    expect(result.code).toContain('expose({ runE2E })')
    expect(result.code).not.toContain('__expose')
  })

  it('rewrites defineExpose calls with arguments on the Babel path', () => {
    const result = transformScript(compiledDefineExposeSource, {
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

    expect(result.code).toMatch(/expose\(\{\s*runE2E\s*\}\)/)
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

  it('injects slot host properties only for imported useSlots calls', () => {
    const imported = transformScript(`
import { useSlots as useSetupSlots } from 'wevu'
export default {
  setup() {
    useSetupSlots()
  },
}
    `.trim(), { sourceMap: false })
    const local = transformScript(`
const useSlots = () => ({})
export default {
  setup() {
    useSlots()
  },
}
    `.trim(), { sourceMap: false })

    expect(imported.code).toContain(WEVU_SLOT_OWNER_ID_PROP)
    expect(local.code).not.toContain(WEVU_SLOT_OWNER_ID_PROP)
  })

  it('falls back to the Babel path for TypeScript SFC output', () => {
    const source = compiledScriptSetupSource.replace(
      `const shared = createSharedLabel('sfc-page')`,
      `const shared = child.$.exposed!.getShowPop()`,
    )
    const result = transformScript(source, {
      isPage: true,
      isTypeScript: true,
      sourceMap: false,
    })

    expect(result.code).toContain('child.$.exposed.getShowPop()')
    expect(result.code).not.toContain('exposed!')
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
