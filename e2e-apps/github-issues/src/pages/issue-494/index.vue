<script setup lang="ts">
import { ref } from 'wevu'
import SlotHost from '../../components/issue-494/SlotHost/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-494',
})

const headerLabel = ref('ready')
const bodyLabel = ref('alpha')
const iconSrc = 'https://static.example.com/issue-494/icon.png'

function toggleLabels() {
  headerLabel.value = headerLabel.value === 'ready' ? 'updated' : 'ready'
  bodyLabel.value = bodyLabel.value === 'alpha' ? 'beta' : 'alpha'
}

function _runE2E() {
  return {
    ok: typeof headerLabel.value === 'string' && typeof bodyLabel.value === 'string',
    headerLabel: headerLabel.value,
    bodyLabel: bodyLabel.value,
    iconSrc,
  }
}
</script>

<template>
  <view class="issue494-page">
    <view class="issue494-title">
      issue-494 template v-slot unwrap
    </view>

    <SlotHost>
      <template #icon>
        <img
          class="issue494-icon-probe"
          data-probe="single-image"
          :src="iconSrc"
        >
      </template>

      <template #header>
        <view class="issue494-header-probe" :data-header-label="headerLabel">
          header via template slot: {{ headerLabel }}
        </view>
        <view class="issue494-header-extra" data-header-extra="true">
          header extra
        </view>
      </template>

      <template #default>
        <view class="issue494-default-probe" :data-body-label="bodyLabel">
          default via template slot: {{ bodyLabel }}
        </view>
      </template>
    </SlotHost>

    <view class="issue494-action" @tap="toggleLabels">
      toggle issue-494 labels
    </view>
  </view>
</template>

<style scoped>
.issue494-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #eef2ff;
}

.issue494-title {
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #1e1b4b;
}

.issue494-icon-probe {
  width: 64rpx;
  height: 64rpx;
}

.issue494-header-probe,
.issue494-default-probe,
.issue494-action {
  color: #312e81;
}

.issue494-action {
  padding: 20rpx;
  margin-top: 20rpx;
  background: #c7d2fe;
  border-radius: 12rpx;
}
</style>
