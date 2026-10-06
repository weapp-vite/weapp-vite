<script setup lang="ts">
import Leaf from '../../components/leaf/index.vue'
import Provider from '../../components/provider/index.vue'
</script>

<template>
  <view>
    <Provider label="outer" :seed="100">
      <Leaf probe="outer-before" />
      <Provider label="inner" :seed="200" :internal="true">
        <view>
          <Leaf probe="inner-wrapped" />
        </view>
        <template #named>
          <Leaf probe="inner-named" />
        </template>
      </Provider>
      <Leaf probe="outer-after" />
    </Provider>
  </view>
</template>
