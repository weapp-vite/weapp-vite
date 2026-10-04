export function createVueSfcFixture() {
  const imports: string[] = []
  const refs: string[] = []
  const cards: string[] = []
  const listItems: string[] = []

  for (let i = 0; i < 24; i++) {
    imports.push(`import TCard${i} from '@/components/TCard${i}'`)
    refs.push(`const count${i} = ref(${i})`)
    refs.push(`const label${i} = computed(() => 'label-' + count${i}.value)`)
    refs.push(`const selected${i} = ref(false)`)
    cards.push(`<TCard${i} class="card-${i}" :title="label${i}" :class="{ active: selected${i}, muted: !selected${i} }" :style="{ width: count${i} + 'px' }" @tap="onTap(${i}, count${i}, $event)" />`)
  }

  for (let i = 0; i < 48; i++) {
    listItems.push(`<view wx:for="{{list${i}}}" wx:key="id" wx:for-item="item" wx:for-index="index">{{ item.title }}-{{ count${i % 24} }}-{{ sharedTitle }}</view>`)
  }

  return `
<template>
  <view class="root">
    <view v-for="group in groups" :key="group.id" class="group">
      ${cards.join('\n      ')}
      ${listItems.join('\n      ')}
      <view>{{ sharedTitle }}</view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, defineComponent, ref, useAttrs, useSlots } from 'vue'
${imports.join('\n')}
${refs.join('\n')}
const groups = ref(Array.from({ length: 8 }, (_, index) => ({ id: index })))
const sharedTitle = computed(() => groups.value.length > 3 ? 'many' : 'few')
const props = defineProps<{ msg: string }>()
const emit = defineEmits<{ tap: [index: number, count: number] }>()
defineOptions({
  options: {
    addGlobalClass: true,
  },
})
definePageJson({
  navigationBarTitleText: 'profile',
})
function onTap(index: number, count: { value: number }, event: unknown) {
  emit('tap', index, count.value)
  return { event, msg: props.msg }
}
</script>
<style scoped>
.root { display: flex; flex-direction: column; }
.group { padding: 12rpx; }
</style>
`.trim()
}

export function createTransformScriptFixture() {
  return `
import { defineComponent, ref } from 'vue'
import { onLoad, useSlots } from 'wevu'
export default defineComponent({
  setup() {
    const count = ref(0)
    const slots = useSlots()
    onLoad(() => { count.value++ })
    return { count, slots }
  },
})
`.trim()
}
