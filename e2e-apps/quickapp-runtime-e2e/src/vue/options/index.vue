<script lang="ts">
export default {
  data() {
    return {
      count: 1 as number,
    }
  },
  methods: {
    increment() {
      this.count += 1
    },
  },
}
</script>

<template>
  <div class="page">
    <text id="options-count" class="value">count={{ count }}</text>
    <text id="options-increment" class="action" @click="increment">increment</text>
  </div>
</template>

<style>
@import '../../Common/base.css';
</style>
