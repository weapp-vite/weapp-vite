<script setup lang="ts">
import Issue613LegacyViewForwarder from '../../components/issue-613/Issue613LegacyViewForwarder/index.vue'
import Issue613ViewForwarder from '../../components/issue-613/Issue613ViewForwarder/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-613',
  usingComponents: {
    'issue613-block-forwarder': '/components/issue-613/block-forwarder/index',
  },
})

function _runE2E() {
  return {
    ok: true,
    issue: 613,
  }
}
</script>

<template>
  <view class="issue613-page">
    <view class="issue613-title">
      issue-613 forwarded slot outlet
    </view>

    <view class="issue613-section" data-issue613-case="compiled-virtual-host">
      <view class="issue613-section-title">
        compiled virtual host wrapper
      </view>
      <Issue613ViewForwarder>
        <view class="issue613-forwarded-content" data-issue613-forwarded="compiled-virtual-host">
          issue-613 forwarded via compiled virtual host
        </view>
        <template #footer>
          <view class="issue613-forwarded-content" data-issue613-forwarded="compiled-footer">
            issue-613 forwarded via compiled footer
          </view>
        </template>
      </Issue613ViewForwarder>
    </view>

    <view class="issue613-section" data-issue613-case="compiled-view">
      <view class="issue613-section-title">
        compiled view fallback wrapper
      </view>
      <Issue613LegacyViewForwarder>
        <view class="issue613-forwarded-content" data-issue613-forwarded="compiled-view">
          issue-613 forwarded via compiled view
        </view>
      </Issue613LegacyViewForwarder>
    </view>

    <view class="issue613-section" data-issue613-case="native-block">
      <view class="issue613-section-title">
        native block wrapper
      </view>
      <issue613-block-forwarder>
        <view class="issue613-forwarded-content" data-issue613-forwarded="native-block">
          issue-613 forwarded via native block
        </view>
      </issue613-block-forwarder>
    </view>

    <Issue613Card data-issue613-case="compiled-fragment">
      <template #header>
        <slot />
      </template>
    </Issue613Card>
  </view>
</template>

<style scoped>
.issue613-page {
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue613-title {
  margin-bottom: 24rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue613-section + .issue613-section {
  margin-top: 24rpx;
}

.issue613-section-title {
  margin-bottom: 12rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: #334155;
}

.issue613-forwarded-content {
  padding: 12rpx 16rpx;
  background: #e0f2fe;
}
</style>
