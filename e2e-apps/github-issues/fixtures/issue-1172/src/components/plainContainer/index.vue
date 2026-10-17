<script setup lang="ts">
import PlainCounter from '../plainCounter/index.vue'
import PlainDualScriptCounter from '../plainDualScriptCounter/index.vue'
import PlainOptionsCounter from '../plainOptionsCounter/index.vue'
import PlainReactiveCounter from '../plainReactiveCounter/index.vue'
</script>

<template>
  <div>
    <text id="plain-leaf-label">Context-free container</text>
    <PlainCounter />
    <PlainOptionsCounter />
    <PlainDualScriptCounter />
    <PlainReactiveCounter />
  </div>
</template>
