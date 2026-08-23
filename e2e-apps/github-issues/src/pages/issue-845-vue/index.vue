<script setup lang="ts">
import { i18n } from 'weapp-vite/i18n'

defineOptions({ behaviors: [i18n.behavior] })

const user = { name: 'Vue' }

function switchLocale() {
  i18n.global.locale = 'en-US'
}
</script>

<template>
  <view id="issue-845-vue" @tap="switchLocale">
    {{ t('issue845.greeting', { user }) }}
  </view>
</template>
