<script setup lang="ts">
import { actionBlockClass, chipWrapClass, labelClass, mutedTextClass, pill } from '../lib/ui'
import SectionCard from './SectionCard.vue'

defineProps<{
  methods: string[]
}>()

const emit = defineEmits<{
  callMethod: [method: string]
  pageScroll: []
  pullRefresh: []
  reachBottom: []
  routeDone: []
  resize: []
}>()
</script>

<template>
  <SectionCard title="🕛 操作" subtitle="页面方法和模拟事件拆成更小的按钮组。">
    <div :class="actionBlockClass">
      <span :class="labelClass">页面方法</span>
      <div :class="chipWrapClass">
        <button
          v-for="method in methods"
          :key="method"
          :class="pill()"
          @click="emit('callMethod', method)"
        >
          {{ method }}
        </button>
        <span v-if="methods.length === 0" :class="mutedTextClass">当前页面没有可调用方法</span>
      </div>
    </div>
    <div :class="actionBlockClass">
      <span :class="labelClass">运行时事件</span>
      <div :class="chipWrapClass">
        <button :class="pill()" @click="emit('pageScroll')">
          pageScrollTo
        </button>
        <button :class="pill()" @click="emit('pullRefresh')">
          下拉刷新
        </button>
        <button :class="pill()" @click="emit('reachBottom')">
          触底
        </button>
        <button :class="pill()" @click="emit('routeDone')">
          路由完成
        </button>
        <button :class="pill()" @click="emit('resize')">
          窗口尺寸
        </button>
      </div>
    </div>
  </SectionCard>
</template>
