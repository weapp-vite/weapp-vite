<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignDropdownMenuPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-dropdown-menu',
}))

const value = ref('a')
const options = ref([{ title: 'A', value: 'a' }, { title: 'B', value: 'b' }])
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-dropdown-menu
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-dropdown-menu>
        <t-dropdown-item :options="options" :value="value" />
      </t-dropdown-menu>
    </view>
  </view>
</template>

