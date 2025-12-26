import { describe, expect, it } from 'vitest'
import { compileVueFile, transformScript } from '../../src/plugins/vue/transform'

describe('Vue 3 API Support', () => {
  describe('transformScript with Vue 3 APIs', () => {
    it('should support onMounted lifecycle hook', () => {
      const source = `
import { onMounted } from 'wevu'
export default {
  setup() {
    onMounted(() => {
      console.log('mounted')
    })
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('onMounted')
      expect(result.code).toContain('createWevuComponent')
    })

    it('should support onUpdated lifecycle hook', () => {
      const source = `
import { onUpdated } from 'wevu'
export default {
  setup() {
    onUpdated(() => {
      console.log('updated')
    })
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('onUpdated')
    })

    it('should support onUnmounted lifecycle hook', () => {
      const source = `
import { onUnmounted } from 'wevu'
export default {
  setup() {
    onUnmounted(() => {
      console.log('unmounted')
    })
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('onUnmounted')
    })

    it('should support toRefs and toRef', () => {
      const source = `
import { reactive, toRefs } from 'wevu'
export default {
  setup() {
    const state = reactive({ count: 0 })
    const { count } = toRefs(state)
    return { count }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('toRefs')
      expect(result.code).toContain('reactive')
    })

    it('should support shallowRef and shallowReactive', () => {
      const source = `
import { shallowRef, shallowReactive } from 'wevu'
export default {
  setup() {
    const foo = shallowRef({ bar: 1 })
    const state = shallowReactive({ nested: {} })
    return { foo, state }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('shallowRef')
      expect(result.code).toContain('shallowReactive')
    })

    it('should support markRaw', () => {
      const source = `
import { reactive, markRaw } from 'wevu'
export default {
  setup() {
    const foo = markRaw({ bar: 1 })
    const state = reactive({ foo })
    return { state }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('markRaw')
    })

    it('should support props in setup', () => {
      const source = `
export default {
  properties: {
    title: String,
    count: Number
  },
  setup(props) {
    console.log(props.title)
    return {}
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('properties')
    })

    it('should support emit in setup', () => {
      const source = `
export default {
  setup(props, { emit }) {
    emit('update', 123)
    return {}
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('emit')
    })

    it('should support expose in setup', () => {
      const source = `
export default {
  setup(props, { expose }) {
    expose({ publicMethod: () => {} })
    return {}
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('expose')
    })
  })

  describe('compileVueFile with Vue 3 APIs', () => {
    it('should compile Vue SFC with onMounted', async () => {
      const source = `
<template>
  <view>{{ message }}</view>
</template>

<script>
import { onMounted, ref } from 'wevu'

export default {
  setup() {
    const message = ref('Hello')
    onMounted(() => {
      console.log('Component mounted')
    })
    return { message }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.script).toContain('onMounted')
      expect(result.script).toContain('ref')
    })

    it('should compile Vue SFC with toRefs', async () => {
      const source = `
<template>
  <view>{{ count }}</view>
</template>

<script>
import { reactive, toRefs } from 'wevu'

export default {
  setup() {
    const state = reactive({ count: 0 })
    const { count } = toRefs(state)
    return { count }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.script).toContain('toRefs')
      expect(result.script).toContain('reactive')
    })

    it('should compile Vue SFC with props and emit', async () => {
      const source = `
<template>
  <view @tap="handleTap">{{ title }}</view>
</template>

<script>
export default {
  properties: {
    title: String
  },
  setup(props, { emit }) {
    function handleTap() {
      emit('tap', props.title)
    }
    return { handleTap }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.script).toContain('properties')
      expect(result.script).toContain('emit')
    })

    it('should compile Vue SFC with shallowReactive', async () => {
      const source = `
<template>
  <view>{{ state.nested.value }}</view>
</template>

<script>
import { shallowReactive } from 'wevu'

export default {
  setup() {
    const state = shallowReactive({
      nested: { value: 1 }
    })
    return { state }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.script).toContain('shallowReactive')
    })

    it('should compile Vue SFC with markRaw', async () => {
      const source = `
<template>
  <view>{{ data.name }}</view>
</template>

<script>
import { reactive, markRaw } from 'wevu'

export default {
  setup() {
    const classInstance = markRaw(new MyClass())
    const state = reactive({ instance: classInstance })
    return { state }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.script).toContain('markRaw')
      expect(result.script).toContain('reactive')
    })
  })

  describe('Unified defineComponent', () => {
    it('should not require type parameter', () => {
      const source = `
export default {
  data() {
    return { count: 0 }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('createWevuComponent')
      // Should not contain type parameter
      expect(result.code).not.toContain('type:')
    })

    it('should always use defineComponent without type', async () => {
      const source = `
<template>
  <view>{{ message }}</view>
</template>

<script>
export default {
  data() {
    return { message: 'Hello' }
  }
}
</script>
`
      const result = await compileVueFile(source, 'test.vue')

      expect(result.script).toBeDefined()
      expect(result.script).toContain('createWevuComponent')
      // The transformed code should use defineComponent without type parameter
      expect(result.script).not.toMatch(/type\s*:\s*['"]page['"]|type\s*:\s*['"]component['"]/)
    })

    it('should support Component() for both pages and components', () => {
      // In WeChat mini-programs, Component() can define both pages and components
      // It supports pageLifetimes for pages
      const source = `
export default {
  data() {
    return { title: 'My Page' }
  },
  pageLifetimes: {
    show() {
      console.log('Page shown')
    }
  }
}`
      const result = transformScript(source)

      expect(result.transformed).toBe(true)
      expect(result.code).toContain('pageLifetimes')
      expect(result.code).toContain('createWevuComponent')
    })
  })
})
