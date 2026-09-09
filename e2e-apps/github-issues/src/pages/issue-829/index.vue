<script setup lang="ts">
import { ref } from 'wevu'
import Card from '../../components/issue-829/Card/index.vue'
import Query from '../../components/issue-829/Query/index.vue'

const queryResolveCount = ref(0)

async function queryFn() {
  const result = await new Promise<string[]>((resolve) => {
    setTimeout(resolve, 1_000, ['foo', 'bar'])
  })
  queryResolveCount.value += 1
  return result
}
</script>

<template>
  <view id="issue-829-page" :data-query-resolve-count="queryResolveCount">
    <Card id="issue829-card" title="nested">
      <Query id="issue-829-nested-query" v-slot="{ label, data }" :query-fn="queryFn" label="Result">
        <view class="issue829-nested-result">
          <text class="issue829-result-label">{{ label }}</text>
          <text v-for="(item, index) in data" :id="`issue829-nested-${index}`" :key="item" class="issue829-result-item">{{ item }}</text>
        </view>
      </Query>
    </Card>
    <Query id="issue-829-direct-query" v-slot="{ label, data }" :query-fn="queryFn" label="Result">
      <view class="issue829-direct-result">
        <text class="issue829-result-label">{{ label }}</text>
        <text v-for="(item, index) in data" :id="`issue829-direct-${index}`" :key="item" class="issue829-result-item">{{ item }}</text>
      </view>
    </Query>
  </view>
</template>
