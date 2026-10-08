import type { ScriptScenario } from './types'
import { compileScenarios } from '../nativeBindingAnalysis/compileScenarios'

type SfcScenario = Extract<ScriptScenario, { kind: 'sfc' }>
type RawScriptScenario = Extract<ScriptScenario, { kind: 'script' }>
type ReservedPropsScenario = Extract<ScriptScenario, { kind: 'reserved-props' }>

function sfc(id: string, source: string): SfcScenario {
  return {
    id: `sfc-${id}`,
    kind: 'sfc',
    filename: `src/components/script-analysis-${id}.vue`,
    source,
    options: { sourceMap: true },
    expectError: false,
    expectWarning: false,
  }
}

function script(id: string, source: string): RawScriptScenario {
  return {
    id: `script-${id}`,
    kind: 'script',
    filename: `src/pages/script-analysis-${id}.ts`,
    source,
    options: { isTypeScript: true, isPage: true, sourceMap: true },
    expectError: false,
    expectWarning: false,
  }
}

function reservedProps(id: string, source: string, expectWarning: boolean, extras: Pick<ReservedPropsScenario, 'start' | 'withoutWarn'> = {}): ReservedPropsScenario {
  return {
    id: `reserved-${id}`,
    kind: 'reserved-props',
    filename: `src/components/script-analysis-${id}.vue`,
    source,
    expectError: false,
    expectWarning,
    ...extras,
  }
}

/** 复用完整编译语料，并补充脚本 AST 复用、宏身份和告警预筛选的关键边界。 */
export async function scriptScenarios(): Promise<ScriptScenario[]> {
  const existing = (await compileScenarios()).map<ScriptScenario>(({ id, filename, source, options, expectError }) => ({
    id: `sfc-${id}`,
    kind: 'sfc',
    filename,
    source,
    options,
    expectError: expectError === true,
  }))

  return [
    ...existing,
    // 沿用 compileVueFile/propsProjection.test.ts 的共享解析与同名 setup 状态场景。
    sfc('shared-props-ast', `<script setup>
import { ref } from 'wevu'
const props = defineProps({ canvasId: String })
const canvasId = ref(props.canvasId || 'shared-props-analysis')
</script><template><canvas :canvas-id="canvasId" /></template>`),
    // 基于 script.test.ts 的 toRefs 返回信息，覆盖别名链和解构默认值。
    sfc('props-return-aliases', `<script setup lang="ts">
import { toRefs } from 'wevu'
const props = defineProps({ title: String, count: Number })
const alias = props
const refs = toRefs(alias)
const { title = 'fallback' } = refs
const { count: snapshot = 0 } = props
</script><template><view>{{ title }} / {{ snapshot }}</view></template>`),
    // script.test.ts 的 TSX fragment 路径加上 props，确保先有旧 AST 再改变源码。
    sfc('jsx-invalidates-props-ast', `<script setup lang="tsx">
const props = defineProps<{ title: string }>()
const fragment = <text>{props.title}</text>
void fragment
</script><template><view>{{ props.title }}</view></template>`),

    script('no-page-meta', `const title = 'ordinary-script'
export default { data() { return { title } } }`),
    // transformScript/fastSetup.test.ts 的规范别名和编译后 setup 内调用。
    script('page-meta-alias', `import { definePageMeta as pageMeta, ref } from 'wevu'
pageMeta({ layout: false })
export default { setup: () => ({ count: ref(0) }) }`),
    script('page-meta-compiled-setup', `export default {
  setup() {
    definePageMeta({ layout: false })
    return {}
  },
}`),
    // 保留原始反斜杠；改编自 pageDeclaration/index.test.ts 的转义导入绑定。
    script('page-meta-escaped-import', String.raw`import { defineP\u0061geMeta as pageMeta } from "w\u0065vu"
pageMeta({ layout: false })
export default {}`),
    script('page-meta-string-import', String.raw`import { "defineP\u0061geMeta" as pageMeta } from "w\u0065vu"
pageMeta({ layout: false })
export default {}`),
    // pageDeclaration/index.test.ts 的值绑定区分；只检验转换，源码不作为运行时 fixture。
    script('page-meta-enum-shadow', `enum definePageMeta { Value }
definePageMeta({ runtime: true })
export default {}`),
    script('page-meta-namespace-shadow', `namespace definePageMeta { export const value = 1 }
definePageMeta({ runtime: true })
export default {}`),
    script('page-meta-type-import', `import type { definePageMeta } from './page-types'
definePageMeta({ layout: false })
export default {}`),
    script('page-meta-ambient-namespace', `declare namespace definePageMeta { type Value = string }
definePageMeta({ layout: false })
export default {}`),

    // compileVueFile/script.test.ts 的 runtime、类型引用和非保留属性告警契约。
    reservedProps('runtime-object', 'const props = defineProps({ id: String, title: String })', true, { start: { line: 9, column: 4 } }),
    reservedProps('type-alias', `interface BaseProps { id: string }
type Props = BaseProps & { title: string }
withDefaults(defineProps<Props>(), { title: 'hello' })`, true),
    reservedProps('unicode-crlf', 'const before = 1\r\nconst emoji = \'😀\'; defineProps([\'slot\'])', true, { start: { line: 11, column: 7 } }),
    reservedProps('escaped-identifier', String.raw`const props = \u0064efineProps({ class: String })`, true),
    reservedProps('no-warning-handler', 'defineProps({ id: String })', false, { withoutWarn: true }),
    reservedProps('no-props-macro', 'const id = \'local\'; const title = \'ordinary-script\'', false),
    reservedProps('readable-props', 'const props = defineProps<{ style: string; hidden: boolean; title: string }>()', false),
  ]
}
