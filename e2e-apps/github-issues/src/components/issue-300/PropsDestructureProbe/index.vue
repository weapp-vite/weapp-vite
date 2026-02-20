<script setup lang="ts">
import { computed } from 'wevu'

const props = defineProps<{
  str: string
  bool: boolean
}>()

const { str, bool } = props

const boolTextFromProps = computed(() => String(props.bool))
const boolTextFromDestructured = computed(() => String(bool))
</script>

<template>
  <view class="issue300-probe">
    <text class="issue300-probe-line issue300-probe-destructured">
      destructured: {{ str }} {{ String(bool) }}
    </text>
    <text class="issue300-probe-line issue300-probe-props">
      props: {{ props.str }} {{ String(props.bool) }}
    </text>
    <text class="issue300-probe-line issue300-probe-computed">
      computed: {{ boolTextFromDestructured }} / {{ boolTextFromProps }}
    </text>
  </view>
</template>

<style scoped>
.issue300-probe {
  padding: 18rpx;
  margin-top: 14rpx;
  background: #fff;
  border: 2rpx solid #dbeafe;
  border-radius: 12rpx;
}

.issue300-probe-line {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #0f172a;
}

.issue300-probe-line:first-child {
  margin-top: 0;
}
</style>
