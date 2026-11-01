<script setup>
import SfcCard from '../../components/SfcCard.vue'
</script>

<template>
  <view>
    <text id="ready">sfc-ready</text>
    <SfcCard />
    <sfc-typo id="sfc-unknown">Inline SFC typo</sfc-typo>
    <svg><foreignObject /></svg>
    <include src="../../shared/sfc-include.wxml" />
    <import src="../../shared/sfc-import.wxml" />
    <!-- eslint-disable-next-line vue/no-lone-template, vue/no-deprecated-html-element-is -- 此节点调用小程序命名模板。 -->
    <template is="sfc-shared" />
  </view>
</template>
