<script lang="ts">
import { defineComponent } from 'wevu'

interface ProbeComponentInstance {
  triggerEvent: (name: string, detail?: unknown) => void
}

export default defineComponent({
  methods: {
    emitProbe(tag = 'manual') {
      this.emitNamed('probe', tag)
    },
    emitNamed(eventName = 'probe', tag = 'manual') {
      const instance = this as unknown as ProbeComponentInstance
      instance.triggerEvent(eventName, {
        source: 'wevu-sfc-component',
        eventName,
        tag,
      })
    },
  },
})
</script>

<template>
  <view class="event-probe">
    event-probe-wevu-vue
  </view>
</template>

<style>
.event-probe {
  padding: 8rpx 10rpx;
  margin: 6rpx 0;
  color: #475569;
  border: 1rpx dashed #94a3b8;
  border-radius: 8rpx;
}
</style>
