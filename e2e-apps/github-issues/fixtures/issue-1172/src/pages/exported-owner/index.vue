<script setup lang="ts">
import ExportedProvider from '../../components/exportedProvider/index.vue'
import Leaf from '../../components/leaf/index.vue'
import Provider from '../../components/provider/index.vue'
</script>

<template>
  <view>
    <Provider label="exported-outer" :seed="100">
      <ExportedProvider>
        <Leaf probe="exported-projected" />
      </ExportedProvider>
      <Leaf probe="exported-outer-leaf" />
    </Provider>
  </view>
</template>
