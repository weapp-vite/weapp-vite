<script setup lang="ts">
import { ref } from 'wevu'
import { label } from './label'

const count = ref(0)
</script>

<template>
  <view id="provider" class="provider-import provider-page" data-provider="template-before">
    <text id="label">{{ label }}</text>
    <button id="increment" @tap="count++">{{ count }}</button>
  </view>
</template>

<style src="./index.css" />
