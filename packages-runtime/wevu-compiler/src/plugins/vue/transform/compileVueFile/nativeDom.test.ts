import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { describe, expect, it } from 'vitest'
import { compileJsxFile } from '../../../jsx/compileJsxFile'
import { getMiniProgramTemplatePlatform } from '../../compiler/template'
import { compileVueFile } from './index'

const source = `<script setup lang="ts">
import { ref } from 'wevu'
import Child from './Child.vue'
const count = ref(0)
</script><template><view v-if="count"><Child :value="count"><text>{{ count }}</text></Child></view><button @tap.capture="count++">add</button></template>`
const tt = getMiniProgramTemplatePlatform('tt')

describe('原生 DOM SFC 编译', () => {
  it('生成 render 后仍将脚本映射回原 SFC', async () => {
    const source = '<script setup>\nconst sentinel = 1\n</script><template><text>{{ sentinel }}</text></template>'
    const result = await compileVueFile(source, 'page.vue', { renderer: 'auto', sourceMap: true, template: { platform: tt } })
    const prefix = result.script!.slice(0, result.script!.indexOf('sentinel')).split('\n')
    expect(originalPositionFor(new TraceMap(JSON.stringify(result.scriptMap)), { line: prefix.length, column: prefix.at(-1)!.length })).toMatchObject({ source: 'page.vue', line: 2, column: 6 })
  })
  it.each([
    '<template><teleport to="x"/></template>',
    '<template><view v-html="html"/></template>',
    '<template><include src="x"/></template>',
    '<template><view tt:if="visible"/></template>',
    '<template><view/></template><style module>.x { color: red }</style>',
  ])('未适配语法明确报错：%s', async (unsupported) => {
    await expect(compileVueFile(unsupported, 'page.vue', { renderer: 'auto', template: { platform: tt } })).rejects.toThrow('native-dom')
  })

  it('拒绝 TT opt-in 的 JSX 入口，非 TT auto 保留原路径', async () => {
    await expect(compileJsxFile('export default { setup: () => () => <view/> }', 'page.tsx', { renderer: 'auto', template: { platform: tt } })).rejects.toThrow('SFC')
  })
  it('共用脚本作用域，保留 SFC 导入并静态生成 render 与后端配置', async () => {
    const result = await compileVueFile(source, 'page.vue', { renderer: 'auto', isPage: true, template: { platform: tt } })
    expect(result.script).toContain('wevu/native-dom')
    expect(result.script).toContain('./Child.vue')
    expect(result.script).toContain('withNativeDom')
    expect(result.script).toMatch(/mode:\s*["']auto["']/)
    expect(result.script).toMatch(/platform:\s*["']tt["']/)
    expect(result.script).toContain('createWevuComponent')
    expect(result.template).toContain('tt:if="{{__wevuLegacyRenderer}}"')
    expect(result.script).not.toMatch(/\beval\s*\(|new Function\b/)
  })

  it('组件逻辑入口拥有注册权，源码只导出虚拟组件', async () => {
    const result = await compileVueFile('<template><text>child</text></template>', 'Child.vue', { renderer: 'native-dom', skipComponentTransform: true, template: { platform: tt } })
    expect(result.script).toContain('withNativeDom')
    expect(result.script).not.toContain('createWevuComponent')
  })

  it('legacy 和非 TT auto 保持原有结果，非 TT native-dom 明确报错', async () => {
    const legacy = await compileVueFile(source, 'page.vue')
    const auto = await compileVueFile(source, 'page.vue', { renderer: 'auto' })
    expect(auto.script).toBe(legacy.script)
    expect(auto.template).toBe(legacy.template)
    await expect(compileVueFile(source, 'page.vue', { renderer: 'native-dom' })).rejects.toThrow('仅支持 tt')
  })
})
