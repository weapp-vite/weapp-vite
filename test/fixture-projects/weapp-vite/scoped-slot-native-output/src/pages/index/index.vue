<script setup lang="ts">
definePageJson({
  usingComponents: {
    'van-tabbar': '/components/native-tabbar/index',
    'van-tabbar-item': '/components/native-tabbar-item/index',
  },
})

const tabItems = [
  {
    label: 'home',
    icon: 'home',
    to: {
      name: 'home',
    },
  },
  {
    label: 'user',
    icon: 'user',
    to: {
      name: 'user',
    },
  },
]
</script>

<template>
  <van-tabbar class="van-safe-area-bottom fixed z-10" :fixed="true" route>
    <van-tabbar-item
      v-for="{ label, icon, to } in tabItems"
      :key="label"
      :icon="icon"
      :name="to.name"
      replace
      :to="to"
    >
      {{ label }}
    </van-tabbar-item>
  </van-tabbar>
</template>
