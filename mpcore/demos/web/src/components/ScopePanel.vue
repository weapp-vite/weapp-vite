<script setup lang="ts">
import HighlightedCode from './HighlightedCode.vue'
import SectionCard from './SectionCard.vue'

defineProps<{
  dataCode: string
  methods: string[]
  propertiesCode: string
  scopeId: string
  scopeType: string
}>()
</script>

<template>
  <SectionCard title="🕛 作用域" subtitle="点击左侧页面或组件后，查看当前实例快照。">
    <div class="sim-action-block">
      <span class="sim-block-label">实例</span>
      <div class="sim-chip-wrap">
        <span class="sim-chip is-active">{{ scopeType }}</span>
        <span class="sim-chip">{{ scopeId || '未选中' }}</span>
      </div>
    </div>
    <div class="sim-action-block">
      <span class="sim-block-label">方法</span>
      <div class="sim-btn-wrap">
        <span v-if="methods.length === 0" class="sim-empty">当前 scope 没有额外方法</span>
        <span v-for="method in methods" :key="method" class="sim-chip">{{ method }}</span>
      </div>
    </div>
    <HighlightedCode :code="propertiesCode" lang="json" />
    <HighlightedCode :code="dataCode" lang="json" />
  </SectionCard>
</template>
