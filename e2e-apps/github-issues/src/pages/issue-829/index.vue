<script setup lang="ts">
import Card from '../../components/issue-829/Card/index.vue'
import Query from '../../components/issue-829/Query/index.vue'

async function queryFn() {
  return new Promise<string[]>((resolve) => {
    setTimeout(resolve, 1_000, ['foo', 'bar'])
  })
}
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
