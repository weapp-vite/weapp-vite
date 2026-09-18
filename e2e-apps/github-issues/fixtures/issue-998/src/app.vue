<script setup>
defineAppJson({ pages: ['pages/index/index'], window: { navigationBarTitleText: 'issue #998' } })
</script>

<template>
  <slot />
</template>

<style>
@import './app.css';
@import './ordinary.css';
</style>
