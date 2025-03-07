<script lang="ts" setup>
import { useToggleTheme } from 'theme-transition'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { nextTick, provide } from 'vue'

const { isDark } = useData()
const { toggleTheme } = useToggleTheme({
  isCurrentDark() {
    return isDark.value
  },
  toggle() {
    isDark.value = !isDark.value
  },
  viewTransition: {
    after() {
      return nextTick()
    },
  },
})

provide('toggle-appearance', toggleTheme)
</script>

<template>
  <DefaultTheme.Layout />
</template>
