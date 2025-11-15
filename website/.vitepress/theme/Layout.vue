<script lang="ts" setup>
import { useToggleTheme } from 'theme-transition'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { nextTick, onBeforeUnmount, onMounted, provide } from 'vue'

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

// add a root flag to boost our theme specificity over default styles
onMounted(() => {
  document.documentElement.classList.add('wv-tech')
  document.body.classList.add('wv-tech')
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('wv-tech')
  document.body.classList.remove('wv-tech')
})
</script>

<template>
  <DefaultTheme.Layout />
</template>
