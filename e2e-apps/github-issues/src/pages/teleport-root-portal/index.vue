<script setup lang="ts">
import { ref } from 'wevu'

const portalDisabled = ref(false)
const showConditionalPortal = ref(true)
const dynamicTarget = '#inner-target'

function _togglePortal() {
  portalDisabled.value = !portalDisabled.value
}

function _toggleConditionalPortal() {
  showConditionalPortal.value = !showConditionalPortal.value
}
</script>

<template>
  <view id="teleport-root-portal-page">
    <text id="teleport-status">{{ portalDisabled ? 'disabled' : 'enabled' }}</text>
    <text id="teleport-conditional-status">{{ showConditionalPortal ? 'shown' : 'hidden' }}</text>

    <Teleport to="body" :disabled="portalDisabled">
      <view id="teleport-portal-content" class="teleport-portal-content">portal-content</view>
    </Teleport>

    <Teleport to="body" disabled defer>
      <view id="teleport-disabled-portal-content">disabled-portal-content</view>
    </Teleport>

    <Teleport to="#inner-target">
      <view id="teleport-degraded-content" class="teleport-degraded-content">degraded-content</view>
    </Teleport>

    <Teleport to="html">
      <view id="teleport-html-content">html-content</view>
    </Teleport>

    <Teleport>
      <view id="teleport-missing-target-content">missing-target-content</view>
    </Teleport>

    <Teleport v-if="showConditionalPortal" to="body">
      <view id="teleport-conditional-content">conditional-content</view>
    </Teleport>

    <Teleport to="body">
      <view id="teleport-nested-outer">
        <Teleport :to="dynamicTarget">
          <view id="teleport-nested-degraded">nested-degraded</view>
        </Teleport>
      </view>
    </Teleport>

    <Teleport to="body">
      <view id="teleport-style-content" class="teleport-style-content" style="color: var(--teleport-accent)">
        styled-content
      </view>
    </Teleport>

    <root-portal :enable="true" externalClass="teleport-external-class">
      <view id="teleport-external-class-content">external-class-content</view>
    </root-portal>
  </view>
</template>

<style>
.teleport-style-content {
  --teleport-accent: #0a8;
}
</style>
