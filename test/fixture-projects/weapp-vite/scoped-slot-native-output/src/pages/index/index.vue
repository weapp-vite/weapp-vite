<script setup lang="ts">
definePageJson({
  usingComponents: {
    'native-tabbar': '/components/native-tabbar/index',
    'native-tabbar-item': '/components/native-tabbar-item/index',
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
  <native-tabbar>
    <native-tabbar-item
      v-for="{ label, icon, to } in tabItems"
      :key="label"
      :icon="icon"
      :label="label"
      :name="to.name"
    >
      {{ label }}
    </native-tabbar-item>
  </native-tabbar>
</template>
