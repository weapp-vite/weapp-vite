import { describe, expect, it } from 'vitest'
import { createAnalysisFixture } from './testSupport'

describe('native context property and coercion proofs', () => {
  it.each([
    ['ordinary getter', 'const value = globalThis.contextSource.token'],
    ['optional getter', 'const value = globalThis.contextSource?.token'],
    ['computed getter', 'const key = "token"; const value = globalThis.contextSource[key]'],
    ['destructured getter', 'const { token: value } = globalThis.contextSource'],
    ['nested destructured getter', 'const { current: { token: value } } = globalThis.contextSource'],
    ['opaque ref input', 'import { ref } from "wevu"; const value = ref(globalThis.contextSource)'],
    ['opaque reactive input', 'import { reactive } from "wevu"; const value = reactive(globalThis.contextSource)'],
    ['opaque property ref', 'import { toRef } from "wevu"; const value = toRef(globalThis.contextSource, "token")'],
    ['opaque getter callback', 'import { toValue } from "wevu"; const value = toValue(globalThis.contextCallback)'],
    ['getter callback body', 'import { toValue } from "wevu"; const value = toValue(() => globalThis.contextSource.token)'],
    ['local accessor', 'const source = { get token() { return globalThis.contextSource.token } }; const value = source.token'],
    ['proxy', 'const source = new Proxy({}, globalThis.handlers); const value = source.token'],
    ['unproven inherited field', 'const source = {}; const value = source.token'],
    ['object coercion', 'const source = {}; const value = source + 1'],
    ['computed key coercion', 'const key = {}; const value = { [key]: 1 }'],
    ['template string coercion', `const source = {}; const value = \`\${source}\``],
    ['unknown field mutation', 'const source = { token: 0 }; source.token = globalThis.contextSource; const value = source.token + 1'],
    ['shape changing mutation', 'const source = { token: 0 }; const alias = source; alias.token = {}; const value = source.token + 1'],
    ['ref shape mutation', 'import { ref, toValue } from "wevu"; const count = ref(0); count.value = {}; const value = toValue(count) + 1'],
    ['deleted own field', 'const source = { token: 0 }; delete source.token; const value = source.token'],
    ['unknown parameter reads', 'function read(source) { return source.token }; const value = read({ token: 0 })'],
  ])('retains %s', async (_name, script) => {
    const result = await createAnalysisFixture().analyze(`<script setup>${script}</script><template><text>{{ value }}</text></template>`)
    expect(result.required).toBe(true)
  })

  it.each([
    ['plain own field', 'const source = { count: 0 }; const value = source.count'],
    ['optional own field', 'const source = { count: 0 }; const value = source?.count'],
    ['computed own field', 'const source = { count: 0 }; const key = "count"; const value = source[key]'],
    ['destructured own field', 'const source = { count: 0 }; const { count: value } = source'],
    ['scalar mutation', 'const source = { count: 0 }; source.count = 1; source.count++; const value = source.count'],
    ['ref read and update', 'import { ref } from "wevu"; const count = ref(0); count.value++; const value = count.value'],
    ['reactive field', 'import { reactive } from "wevu"; const state = reactive({ count: 0 }); state.count++; const value = state.count'],
    ['property ref', 'import { reactive, toRef } from "wevu"; const state = reactive({ count: 0 }); const value = toRef(state, "count")'],
    ['computed key property ref', 'import { reactive, toRef } from "wevu"; const state = reactive({ count: 0 }); const key = "count"; const value = toRef(state, key)'],
    ['ref collection', 'import { reactive, toRefs } from "wevu"; const state = reactive({ count: 0 }); const { count: value } = toRefs(state)'],
    ['ref value', 'import { ref, toValue } from "wevu"; const count = ref(0); const value = toValue(count)'],
    ['getter value', 'import { ref, toValue } from "wevu"; const count = ref(0); const value = toValue(() => count.value)'],
    ['getter ref', 'import { ref, toRef } from "wevu"; const count = ref(0); const value = toRef(() => count.value)'],
    ['computed value', 'import { ref, computed } from "wevu"; const count = ref(0); const value = computed(() => count.value + 1)'],
  ])('omits protocol for proven %s', async (_name, script) => {
    const result = await createAnalysisFixture().analyze(`<script setup>${script}</script><template><text>{{ value }}</text></template>`)
    expect(result.required).toBe(false)
  })

  it('follows actual imported return shapes without trusting inherited fields', async () => {
    const fixture = createAnalysisFixture({
      '/project/values.ts': 'export function makeValue() { return { count: 0 } }',
    })
    const source = `<script setup>import { makeValue } from './values'; const source = makeValue(); const value = source.count</script><template><text>{{ value }}</text></template>`
    expect((await fixture.analyze(source)).required).toBe(false)
    fixture.files.set('/project/values.ts', 'export function makeValue() { return {} }')
    fixture.cache.delete('/project/values.ts')
    expect((await fixture.analyze(source)).required).toBe(true)
    fixture.files.set('/project/values.ts', 'export function makeValue() { return { count: 1 } }')
    fixture.cache.delete('/project/values.ts')
    expect((await fixture.analyze(source)).required).toBe(false)
  })

  it('keeps explicit exports authoritative over star-exported object shapes', async () => {
    const fixture = createAnalysisFixture({
      '/project/barrel.ts': 'export const value = {}; export * from "./other"',
      '/project/other.ts': 'export const value = { token: 0 }',
    })
    const result = await fixture.analyze('<script setup>import { value } from "./barrel"; const token = value.token</script><template><text>{{ token }}</text></template>')
    expect(result.required).toBe(true)
  })

  it.each([
    'export let latest; export function makeValue() { const value = { token: 0 }; latest = value; return value }',
    'const shared = { token: 0 }; export function makeValue() { return { nested: shared } }',
    'const sink = {}; export function makeValue() { const value = { token: 0 }; const alias = sink; alias.value = value; return value }',
  ])('retains escaped factory results: %s', async (helper) => {
    const fixture = createAnalysisFixture({ '/project/helper.ts': helper })
    const result = await fixture.analyze('<script setup>import { makeValue } from "./helper"; const value = makeValue()</script><template><text>{{ value }}</text></template>')
    expect(result.required).toBe(true)
  })
})
