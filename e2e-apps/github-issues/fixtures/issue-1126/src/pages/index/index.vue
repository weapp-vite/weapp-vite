<script setup lang="ts">
import { shallowRef } from 'wevu'
import ApplyShared from '../../components/applyShared/index.vue'
import DefaultIsolation from '../../components/defaultIsolation/index.vue'
import GlobalClass from '../../components/globalClass/index.vue'
import Isolated from '../../components/isolated/index.vue'
import Shared from '../../components/shared/index.vue'

const count = shallowRef(0)
const localTheme = shallowRef(true)
</script>

<template>
  <view id="global-probe" class="global-probe">App global style</view>
  <view id="inline-probe" class="inline-probe">App inline style</view>
  <view id="local-probe" class="global-probe local-probe">Page overrides app</view>
  <Isolated id="isolated" />
  <DefaultIsolation id="default-isolation" />
  <ApplyShared id="apply-shared" />
  <Shared id="shared" />
  <GlobalClass id="global-class" />
  <view id="local-theme" :class="localTheme ? 'local-theme' : ''">
    <ApplyShared id="local-theme-probe" />
  </view>
  <button id="toggle-theme" @tap="localTheme = !localTheme">Toggle local theme</button>
  <button id="increment" @tap="count++">Increment</button>
  <text id="counter">{{ count }}</text>
</template>

<style src="./index.css"></style>
