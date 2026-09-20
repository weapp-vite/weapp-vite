import type { ComputedRef } from 'vue'
import { runInNewContext } from 'node:vm'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { computed, reactive } from 'vue'
import { generate, parse, traverse } from '../../../../utils/babel'
import { compileVueFile } from './index'

describe('SFC props alias destructuring', () => {
  it('preserves ordinary JavaScript snapshots while props reads remain reactive', async () => {
    const result = await compileVueFile(`<script setup lang="ts">
import { computed } from 'wevu'
const props = defineProps<{ enabled: boolean }>()
const { enabled } = props
const snapshot = computed(() => enabled)
const live = computed(() => props.enabled)
</script>
<template><view>{{ snapshot }} / {{ live }}</view></template>`, '/project/src/props-alias.vue')

    const setupMethods: t.ObjectMethod[] = []
    traverse(parse(result.script!, { sourceType: 'module' }), {
      ObjectMethod(path) {
        if (t.isIdentifier(path.node.key, { name: 'setup' })) {
          setupMethods.push(path.node)
        }
      },
    })
    expect(setupMethods).toHaveLength(1)
    // 执行完整编译流水线生成的 setup，避免用生成代码文本代替解构与依赖追踪语义。
    const options = runInNewContext(`(${generate(t.objectExpression(setupMethods)).code})`, { computed }) as {
      setup: (props: { enabled: boolean }, context: { expose: () => void }) => {
        snapshot: ComputedRef<boolean>
        live: ComputedRef<boolean>
      }
    }
    const props = reactive({ enabled: true })
    const bindings = options.setup(props, { expose() {} })
    expect(bindings.snapshot.value).toBe(true)
    expect(bindings.live.value).toBe(true)

    props.enabled = false
    expect(bindings.snapshot.value).toBe(true)
    expect(bindings.live.value).toBe(false)
  })
})
