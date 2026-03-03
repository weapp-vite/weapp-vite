import { describe, expect, it } from 'vitest'
import { parseScriptSetupAst } from './parse'
import {
  stripJsonMacroCallsFromCode,
  stripScriptSetupMacroStatements,
} from './rewrite'

describe('jsonMacros rewrite', () => {
  it('strips top-level macro statements from script setup', () => {
    const content = `
const title = 'home'
definePageJson({ navigationBarTitleText: title })
console.log(title)
    `.trim()

    const ast = parseScriptSetupAst(content, '/project/src/pages/home.vue')
    const result = stripScriptSetupMacroStatements(content, ast, '/project/src/pages/home.vue')

    expect(result.stripped).not.toContain('definePageJson')
    expect(result.stripped).toContain('const title')
    expect(result.stripped).toContain('console.log')
    expect(result.macroStatementSources).toHaveLength(1)
    expect(result.macroStatementSources[0]).toContain('definePageJson')
  })

  it('throws when macro has invalid argument count', () => {
    const content = `
definePageJson()
    `.trim()
    const ast = parseScriptSetupAst(content, '/project/src/pages/home.vue')

    expect(() =>
      stripScriptSetupMacroStatements(content, ast, '/project/src/pages/home.vue'),
    ).toThrow('必须且只能传 1 个参数')
  })

  it('strips json macro calls from arbitrary code blocks', () => {
    const code = `
const local = 1
definePageJson({ navigationBarTitleText: 'x' })
function run() {
  defineComponentJson({ options: {} })
}
export { local }
    `.trim()

    const stripped = stripJsonMacroCallsFromCode(code, '/project/src/pages/home.ts')
    expect(stripped).not.toContain('definePageJson')
    expect(stripped).not.toContain('defineComponentJson')
    expect(stripped).toContain('const local = 1')
    expect(stripped).toContain('export { local }')
  })

  it('throws wrapped parse error when both parsers fail', () => {
    expect(() =>
      stripJsonMacroCallsFromCode('const =', '/project/src/pages/invalid.ts'),
    ).toThrow('解析 /project/src/pages/invalid.ts 的编译脚本失败')
  })
})
