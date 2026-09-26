<script setup lang="ts">
import DebugPanel from '../../components/DebugPanel.vue'
const visible = true
const items = [1, 2]
function tap() {}
</script>

<template>
  <!-- vue-comment -->
  <div id="vue" data-testid="vue" data-debug-info="mapped-debug" aria-label="accessible">
    <text v-if="visible" data-testid="conditional" @tap="tap">conditional-content</text>
    <text v-for="item in items" :key="item" data-testid="vue-loop">{{ item }}</text>
    <DebugPanel data-testid="vue-component-call" />
    <div data-testid="precise-vue" data-testid-extra="precise-vue-extra"><text data-testid="precise-vue-text">precise-vue-child</text></div>
    <text>vue-business-content</text>
  </div>
</template>
