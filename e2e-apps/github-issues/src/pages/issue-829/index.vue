<script setup lang="ts">
import { ref, useNativeInstance } from 'wevu'
import Card from '../../components/issue-829/Card/index.vue'
import Query from '../../components/issue-829/Query/index.vue'

const nativeInstance = useNativeInstance()
const queryCallCount = ref(0)

async function queryFn() {
  queryCallCount.value += 1
  return new Promise<string[]>((resolve) => {
    setTimeout(resolve, 1_000, ['foo', 'bar'])
  })
}

function readQuery(selector: string) {
  const query = (nativeInstance as any).selectComponent?.(selector)
  return typeof query?._runE2E === 'function' ? query._runE2E() : null
}

function _runE2E() {
  return {
    direct: readQuery('#issue-829-direct-query'),
    queryCallCount: queryCallCount.value,
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view id="issue-829-page">
    <Card title="nested">
      <Query id="issue-829-nested-query" v-slot="{ label, data }" :query-fn="queryFn" label="Result">
        <view class="issue829-nested-result">{{ label }}: {{ data }}</view>
      </Query>
    </Card>
    <Query id="issue-829-direct-query" v-slot="{ label, data }" :query-fn="queryFn" label="Result">
      <view class="issue829-direct-result">{{ label }}: {{ data }}</view>
    </Query>
  </view>
</template>
