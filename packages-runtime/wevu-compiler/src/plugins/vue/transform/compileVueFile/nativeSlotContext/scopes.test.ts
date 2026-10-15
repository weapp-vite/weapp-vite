import { describe, expect, it } from 'vitest'
import { createAnalysisFixture } from './testSupport'

const counterTemplate = '<template><button @click="increment">{{ count }}</button></template>'

describe('native context SFC binding scopes', () => {
  it.each([
    ['Options method', `<script>import { ref } from 'wevu'; export default { setup() { const count = ref(0); const increment = () => count.value++; return { count, increment } } }</script>`],
    ['Options aliases', `<script>import { ref } from 'wevu'; export default { setup() { const local = ref(0); const add = () => local.value++; const exposed = { count: local, increment: add }; return exposed } }</script>`],
    ['module variables', `<script>import { ref } from 'wevu'; const count = ref(0); const increment = () => count.value++; export default { setup() { return { count, increment } } }</script>`],
    ['setup function alias', `<script>import { ref } from 'wevu'; const setup = () => { const count = ref(0); const increment = () => count.value++; return { count, increment } }; export default { setup }</script>`],
    ['typed options', `<script lang="ts">import { defineComponent as component, ref } from 'vue'; const options = { setup() { const count = ref<number>(0); const increment = () => count.value++; return { count, increment } } } satisfies Record<string, unknown>; export default component(options)</script>`],
    ['typed component expression', `<script lang="ts">import { defineComponent, ref } from 'vue'; export default (defineComponent({ setup() { const count = ref(0); const increment = () => count.value++; return { count, increment } } }) satisfies Record<string, unknown>)</script>`],
    ['duplicate runtime imports', `<script>import { ref } from 'wevu'; const seed = ref(0)</script><script setup>import { ref } from 'wevu'; const count = ref(seed.value); const increment = () => count.value++</script>`],
    ['module helper', `<script>import { ref } from 'wevu'; function seed() { return ref(0) }</script><script setup>const count = seed(); const increment = () => count.value++</script>`],
    ['independent runtime aliases', `<script>import { ref as localRef } from 'wevu'; const seed = localRef(0)</script><script setup>import { ref as localRef } from 'wevu'; const count = localRef(seed.value); const increment = () => count.value++</script>`],
    ['exported primitive', `<script>export const seed = 0</script><script setup>import { ref } from 'wevu'; const count = ref(seed); const increment = () => count.value++</script>`],
    ['exported fresh factory', `<script>import { ref } from 'wevu'; export function seed() { return ref(0) }</script><script setup>const count = seed(); const increment = () => count.value++</script>`],
  ])('omits protocol with %s', async (_name, scripts) => {
    expect((await createAnalysisFixture().analyze(scripts + counterTemplate)).required).toBe(false)
  })

  it.each([
    ['exported mutable seed', `<script>import { ref } from 'wevu'; export const seed = ref(0)</script><script setup>import { ref } from 'wevu'; const count = ref(seed.value); const increment = () => count.value++</script>`],
    ['mutable seed exposed through getter', `<script>import { ref } from 'wevu'; const seed = ref(0); export function getSeed() { return seed }</script><script setup>import { ref } from 'wevu'; const count = ref(seed.value); const increment = () => count.value++</script>`],
    ['mutable seed exposed through alias', `<script>import { ref } from 'wevu'; const seed = ref(0); const alias = seed; export { alias }</script><script setup>import { ref } from 'wevu'; const count = ref(seed.value); const increment = () => count.value++</script>`],
    ['mutable seed exposed after assignment', `<script>import { ref } from 'wevu'; const seed = ref(0); export let getSeed; getSeed = () => seed</script><script setup>import { ref } from 'wevu'; const count = ref(seed.value); const increment = () => count.value++</script>`],
    ['unreturned local', `<script>import { ref } from 'wevu'; export default { setup() { const count = ref(0); const increment = () => count.value++; return { count } } }</script>`],
    ['opaque setup', '<script>export default { setup: globalThis.setup }</script>'],
    ['opaque options factory', '<script>export default makeOptions()</script>'],
    ['opaque setup return', '<script>export default { setup() { return globalThis.exposed } }</script>'],
    ['conditional setup returns', `<script>import { ref } from 'wevu'; export default { setup(props) { const count = ref(0); if (props.alternate) return globalThis.exposed; return { count, increment: () => count.value++ } } }</script>`],
    ['shadowed runtime import', `<script setup>import { ref } from 'wevu'; function useValue(ref) { return ref() }; const count = useValue(globalThis.factory); const increment = () => count.value++</script>`],
    ['module helper context call', `<script>import { inject } from 'wevu'; function seed() { return inject('token') }</script><script setup>const count = seed(); const increment = () => {}</script>`],
    ['module helper getter', `<script>function seed() { return globalThis.contextSource.token }</script><script setup>const count = seed(); const increment = () => {}</script>`],
    ['template-only handler body', `<script setup>const count = 0; const increment = () => globalThis.contextSource.token</script>`],
  ])('retains %s', async (_name, scripts) => {
    expect((await createAnalysisFixture().analyze(scripts + counterTemplate)).required).toBe(true)
  })

  it('keeps template loop names separate from Options returned aliases', async () => {
    const source = `<script>import { inject } from 'wevu'; export default { setup() { return { increment: inject, rows: [1, 2] } } }</script><template><button v-for="increment in rows">{{ increment }}</button></template>`
    // 返回上下文 API 本身可被模板或其他组件调用，不能因循环同名而忽略。
    expect((await createAnalysisFixture().analyze(source)).required).toBe(true)
    const pure = `<script>export default { setup() { return { rows: [1, 2] } } }</script><template><text v-for="inject in rows">{{ inject }}</text></template>`
    expect((await createAnalysisFixture().analyze(pure)).required).toBe(false)
  })

  it('invalidates imported return proofs across re-export and leaf edits', async () => {
    const fixture = createAnalysisFixture({
      '/project/barrel.ts': 'export { useCount } from "./count"',
      '/project/count.ts': 'import { ref } from "wevu"; export function useCount() { return ref(0) }',
    })
    const source = `<script setup>import { useCount } from './barrel'; const count = useCount(); const increment = () => count.value++</script>${counterTemplate}`
    expect((await fixture.analyze(source)).required).toBe(false)
    fixture.files.set('/project/count.ts', 'export function useCount() { return globalThis.contextSource.token }')
    fixture.cache.delete('/project/count.ts')
    expect((await fixture.analyze(source)).required).toBe(true)
    fixture.files.set('/project/count.ts', 'import { ref } from "wevu"; export function useCount() { return ref(1) }')
    fixture.cache.delete('/project/count.ts')
    expect((await fixture.analyze(source)).required).toBe(false)
  })
})
