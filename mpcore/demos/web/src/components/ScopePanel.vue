<script setup lang="ts">
import { actionBlockClass, chipWrapClass, labelClass, mutedTextClass, pill } from '../lib/ui'
import HighlightedCode from './HighlightedCode.vue'
import SectionCard from './SectionCard.vue'

defineProps<{
  dataCode: string
  methods: string[]
  propertiesCode: string
  scopeId: string
  scopeType: string
  theme?: 'light' | 'dark'
}>()
</script>

<template>
  <SectionCard title="🕛 作用域" subtitle="点击左侧页面或组件后，查看当前实例快照。">
    <div :class="actionBlockClass">
      <span :class="labelClass">实例</span>
      <div :class="chipWrapClass">
        <span :class="pill({ tone: 'accent', interactive: false })">{{ scopeType }}</span>
        <span :class="pill({ tone: 'subtle', interactive: false })">{{ scopeId || '未选中' }}</span>
      </div>
    </div>
    <div :class="actionBlockClass">
      <span :class="labelClass">方法</span>
      <div :class="chipWrapClass">
        <span v-if="methods.length === 0" :class="mutedTextClass">当前 scope 没有额外方法</span>
        <span
          v-for="method in methods"
          :key="method"
          :class="pill({ tone: 'neutral', interactive: false })"
        >
          {{ method }}
        </span>
      </div>
    </div>
    <HighlightedCode :code="propertiesCode" lang="json" :theme="theme" />
    <HighlightedCode :code="dataCode" lang="json" :theme="theme" />
  </SectionCard>
</template>
