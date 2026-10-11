<script setup lang="ts">
import Leaf from '../../components/leaf/index.vue'
import Provider from '../../components/provider/index.vue'
</script>

<template>
  <view>
    <Provider label="primary" :seed="0">
      <Leaf probe="primary" />
    </Provider>
  </view>
</template>
