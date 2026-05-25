<script setup lang="ts">
import Tabbar from '../../components/issue-615/Tabbar/index.vue'
import TabbarItem from '../../components/issue-615/TabbarItem/index.vue'
import { list } from './lib'

definePageJson({
  navigationBarTitleText: 'issue-615',
})

function _runE2E() {
  return {
    ok: true,
    labels: list.map(item => item.label),
  }
}
</script>

<template>
  <view class="issue615-page">
    <view class="issue615-title">
      issue-615 scoped slot v-for owner list
    </view>

    <Tabbar>
      <template #default="slotProps">
        <TabbarItem
          v-for="item in list"
          :key="item.label"
          :data-issue615-slot-ready="slotProps ? 'ready' : 'missing'"
        >
          <text
            class="issue615-label"
            :data-issue615-label="item.label"
          >
            {{ item.label }}
          </text>
        </TabbarItem>
      </template>
    </Tabbar>
  </view>
</template>

<style scoped>
.issue615-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #fff;
}

.issue615-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.issue615-label {
  display: block;
  font-size: 28rpx;
  color: #111827;
}
</style>
