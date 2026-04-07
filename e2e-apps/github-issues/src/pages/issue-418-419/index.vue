<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-418-419',
  usingComponents: {
    'native-ref-probe': '../../components/issue-418-419/NativeRefProbe/index',
  },
})

const nativeButtonRef = useTemplateRef<Record<string, any>>('nativeButton')
const mounted = ref(false)

const nativeButtonReady = computed(() => Boolean(nativeButtonRef.value))
const nativeButtonLabel = computed(() => {
  const data = nativeButtonRef.value?.__data__
  if (!data || typeof data !== 'object') {
    return null
  }
  return typeof data.label === 'string' ? data.label : null
})

function inspectNativeRef() {
  const currentPage = (getCurrentPages() as Array<Record<string, any>>).at(-1)

  try {
    const target = nativeButtonRef.value
    if (!target || typeof target !== 'object') {
      return {
        ready: false,
        ownKeysSample: [] as string[],
        descriptorConfigurable: null as boolean | null,
        hasDataObject: false,
        errorMessage: null as string | null,
      }
    }

    const ownKeysSample = Object.keys(target).slice(0, 8)
    const descriptor = Object.getOwnPropertyDescriptor(target, '__data__')

    return {
      ready: true,
      ownKeysSample,
      descriptorConfigurable: descriptor?.configurable ?? null,
      hasDataObject: Boolean(target.__data__ && typeof target.__data__ === 'object'),
      errorMessage: null as string | null,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (currentPage) {
      currentPage.__issue418419RuntimeError = message
    }
    return {
      ready: false,
      ownKeysSample: [] as string[],
      descriptorConfigurable: null as boolean | null,
      hasDataObject: false,
      errorMessage: message,
    }
  }
}

onMounted(() => {
  mounted.value = true
})

function _runE2E() {
  const currentPage = (getCurrentPages() as Array<Record<string, any>>).at(-1)
  const inspection = inspectNativeRef()

  return {
    ok: mounted.value && inspection.ready && inspection.errorMessage == null,
    mounted: mounted.value,
    nativeButtonReady: nativeButtonReady.value,
    nativeButtonLabel: nativeButtonLabel.value,
    descriptorConfigurable: inspection.descriptorConfigurable,
    hasDataObject: inspection.hasDataObject,
    ownKeysSample: inspection.ownKeysSample,
    runtimeError: inspection.errorMessage ?? currentPage?.__issue418419RuntimeError ?? null,
  }
}
</script>

<template>
  <view class="issue418419-page">
    <text class="issue418419-title">
      issue-418-419 template ref native component
    </text>
    <text class="issue418419-state">
      mounted: {{ mounted ? 'yes' : 'no' }}
    </text>
    <text class="issue418419-state">
      native ref ready: {{ nativeButtonReady ? 'yes' : 'no' }}
    </text>
    <text class="issue418419-state">
      native label: {{ nativeButtonLabel || 'pending' }}
    </text>
    <native-ref-probe
      ref="nativeButton"
      label="issue-418-419"
      class="issue418419-button"
    />
  </view>
</template>

<style scoped>
.issue418419-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #fff;
}

.issue418419-title,
.issue418419-state {
  display: block;
}

.issue418419-title {
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue418419-state {
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: #334155;
}

.issue418419-button {
  margin-top: 16rpx;
}
</style>
