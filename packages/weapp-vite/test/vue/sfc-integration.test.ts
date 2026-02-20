import { compileScript, parse } from 'vue/compiler-sfc'
import { compileVueStyleToWxss, compileVueTemplateToWxml } from 'wevu/compiler'
import { compileVueFile } from '../../src/plugins/vue/transform'

describe('Vue SFC Integration Tests', () => {
  describe('Complete SFC Compilation', () => {
    it('should compile a simple Vue SFC', () => {
      const sfc = `
<template>
  <view class="container">
    <text>{{ message }}</text>
    <button @click="handleClick">Click me</button>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const message = ref('Hello World')
const handleClick = () => {
  console.log('Button clicked')
}
</script>

<style scoped>
.container {
  padding: 20rpx;
}
</style>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })

      // 1. Compile template
      const templateResult = compileVueTemplateToWxml(
        descriptor.template!.content,
        'test.vue',
      )
      expect(templateResult.code).toContain('class="container"')
      expect(templateResult.code).toContain('{{message}}')
      expect(templateResult.code).toContain('bindtap="handleClick"')

      // 2. Compile script
      const scriptCompiled = compileScript(descriptor, { id: 'test.vue' })
      expect(scriptCompiled.content).toContain('ref')
      expect(scriptCompiled.content).toContain('message')

      // 3. Compile style
      const styleResult = compileVueStyleToWxss(descriptor.styles[0], {
        id: 'test123',
        scoped: true,
      })
      expect(styleResult.code).toContain('[data-v-test123]')
    })

    it('should compile SFC with v-model', () => {
      const sfc = `
<template>
  <view>
    <input v-model="username" />
    <textarea v-model="bio"></textarea>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const username = ref('')
const bio = ref('')
</script>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })
      const templateResult = compileVueTemplateToWxml(
        descriptor.template!.content,
        'test.vue',
      )

      expect(templateResult.code).toContain('value="{{username}}"')
      expect(templateResult.code).toContain('bindinput="__weapp_vite_model"')
      expect(templateResult.code).toContain('data-wv-model="username"')
      expect(templateResult.code).toContain('value="{{bio}}"')
      expect(templateResult.code).toContain('data-wv-model="bio"')
    })

    it('should compile SFC with v-for and v-if', () => {
      const sfc = `
<template>
  <view>
    <view v-for="item in items" :key="item.id" v-if="visible">
      {{ item.name }}
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const items = ref([{ id: 1, name: 'Item 1' }])
const visible = ref(true)
</script>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })
      const templateResult = compileVueTemplateToWxml(
        descriptor.template!.content,
        'test.vue',
      )

      expect(templateResult.code).toContain('wx:for="{{items}}"')
      expect(templateResult.code).toContain('wx:for-item="item"')
      // v-if on the same element as v-for gets special handling
    })

    it('should compile SFC with slots', () => {
      const sfc = `
<template>
  <view>
    <slot name="header"></slot>
    <slot>Default content</slot>
    <slot name="footer"></slot>
  </view>
</template>

<script>
export default {}
</script>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })
      const templateResult = compileVueTemplateToWxml(
        descriptor.template!.content,
        'test.vue',
      )

      expect(templateResult.code).toContain('name="header"')
      expect(templateResult.code).toContain('Default content')
      expect(templateResult.code).toContain('name="footer"')
    })

    it('should compile SFC with CSS Modules', () => {
      const sfc = `
<template>
  <view :class="$style.container">
    <text :class="$style.title">Title</text>
  </view>
</template>

<script>
export default {}
</script>

<style module>
.container {
  padding: 20rpx;
}
.title {
  font-size: 32rpx;
}
</style>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })

      // Compile style
      const styleResult = compileVueStyleToWxss(descriptor.styles[0], {
        id: 'test123',
        modules: true,
      })

      expect(styleResult.modules).toBeDefined()
      const $style = styleResult.modules?.$style
      expect($style).toBeDefined()
      expect($style?.container).toMatch(/container_\w+/)
      expect($style?.title).toMatch(/title_\w+/)
    })

    it('should compile SFC with dynamic component', () => {
      const sfc = `
<template>
  <component :is="currentView" :data="data" />
</template>

<script setup>
import { ref } from 'vue'

const currentView = ref('home')
const data = ref({ message: 'Hello' })
</script>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })
      const templateResult = compileVueTemplateToWxml(
        descriptor.template!.content,
        'test.vue',
      )

      expect(templateResult.code).toContain('data-is="{{currentView}}"')
      expect(templateResult.code).toContain('data="{{data}}"')
    })

    it('should compile SFC with transition', () => {
      const sfc = `
<template>
  <transition name="fade">
    <view v-if="show">Fade content</view>
  </transition>
</template>

<script setup>
import { ref } from 'vue'

const show = ref(true)
</script>

<style>
.fade-enter-active {
  transition: opacity 0.5s;
}
</style>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })
      const templateResult = compileVueTemplateToWxml(
        descriptor.template!.content,
        'test.vue',
      )

      // transition should render its children
      expect(templateResult.code).toContain('Fade content')
      expect(templateResult.warnings.some(w => w.includes('transition'))).toBe(true)
    })
  })

  it('should keep class runtime safe for scoped-slot v-for and v-if guarded props', async () => {
    const sfc = `
<template>
  <map :markers="markers">
    <template #callout>
      <cover-view
        v-for="(event, index) in events"
        :key="event.id"
        :marker-id="index"
        :class="[
          'base',
          isExpand.callout ? 'expanded' : 'collapsed',
          selectedEventIdx === index ? (event.isPublic ? 'pub' : 'pri') : 'idle',
        ]"
      />
    </template>
  </map>
  <view v-if="root" :class="root.a" />
</template>

<script setup lang="ts">
defineProps<{
  root?: { a: string }
}>()

const markers = []
const events = []
const isExpand = { callout: false }
const selectedEventIdx = -1
</script>
    `.trim()

    const result = await compileVueFile(sfc, 'test.vue', {
      template: {
        classStyleRuntime: 'js',
      },
    })

    expect(result.script).toContain('__wv_expr_err')
    expect(result.script).toContain('__wevuNormalizeClass(__wevuUnref(this.__wevuProps')
    expect(result.script).toContain('__wevuProps.root')
    expect(result.script).toContain(': this.root).a')
    expect(result.script).toContain('event.isPublic ? \'pub\' : \'pri\'')
    expect(result.script).toContain('__wevuProps.events')
    expect(result.script).toContain(': this.events')
  })

  it('should unref computed boolean in class ternary expression', async () => {
    const sfc = `
<template>
  <view :class="computedValue ? 'a' : 'b'" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const source = true
const computedValue = computed(() => Boolean(source))
</script>
    `.trim()

    const result = await compileVueFile(sfc, 'test.vue', {
      template: {
        classStyleRuntime: 'js',
      },
    })

    expect(result.script).toContain('__wevuNormalizeClass(__wevuUnref(this.__wevuProps')
    expect(result.script).toContain('__wevuProps.computedValue')
    expect(result.script).toContain(': this.computedValue) ? \'a\' : \'b\')')
    expect(result.script).toContain('__wv_expr_err')
  })

  describe('Complex SFC Scenarios', () => {
    it('should handle nested components', () => {
      const sfc = `
<template>
  <view class="outer">
    <my-component :value="data" @update="handleUpdate">
      <template #header>
        <view>Custom Header</view>
      </template>
    </my-component>
  </view>
</template>

<script setup>
import MyComponent from './MyComponent.vue'

const data = ref('test')
const handleUpdate = (val) => {
  data.value = val
}
</script>

<style scoped>
.outer {
  width: 100%;
}
</style>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })

      // Template
      const templateResult = compileVueTemplateToWxml(
        descriptor.template!.content,
        'test.vue',
      )
      expect(templateResult.code).toContain('my-component')
      expect(templateResult.code).toContain('value="{{data}}"')

      // Style
      const styleResult = compileVueStyleToWxss(descriptor.styles[0], {
        id: 'test456',
        scoped: true,
      })
      expect(styleResult.code).toContain('[data-v-test456]')
    })

    it('should handle multiple style blocks', () => {
      const sfc = `
<template>
  <view class="container">Content</view>
</template>

<style scoped>
.container {
  padding: 20rpx;
}
</style>

<style>
.container {
  margin: 10rpx;
}
</style>
      `.trim()

      const { descriptor } = parse(sfc, { filename: 'test.vue' })

      expect(descriptor.styles).toHaveLength(2)

      // Compile both styles
      const style1 = compileVueStyleToWxss(descriptor.styles[0], { id: 'test1', scoped: true })
      const style2 = compileVueStyleToWxss(descriptor.styles[1], { id: 'test2', scoped: false })

      expect(style1.code).toContain('[data-v-test1]')
      expect(style2.code).not.toContain('[data-v-')
    })
  })
})
