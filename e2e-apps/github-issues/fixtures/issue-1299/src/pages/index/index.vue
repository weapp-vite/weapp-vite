<script setup lang="ts">
import Consumer from '../../components/consumer/index.vue'
import Provider from '../../components/provider/index.vue'

definePageMeta({ layout: 'default' })
</script>

<template>
  <view id="issue1299-page">
    <Provider label="left" :seed="0">
      <Consumer probe="left" />
    </Provider>
    <Provider label="right" :seed="10">
      <Consumer probe="right" />
    </Provider>
  </view>
</template>
