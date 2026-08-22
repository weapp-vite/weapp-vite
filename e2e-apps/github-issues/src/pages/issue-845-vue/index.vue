<script setup lang="ts">
import { I18n, setLocale } from 'weapp-vite/i18n'

defineOptions({ behaviors: [I18n] })

const user = { name: 'Vue' }

function switchLocale() {
  setLocale('en-US')
}
</script>

<template>
  <view id="issue-845-vue" @tap="switchLocale">
    {{ t('issue845.greeting', { user }) }}
  </view>
</template>
