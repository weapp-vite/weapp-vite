<script setup lang="ts">
import Cell from '../../components/issue-558/Cell/index.vue'
import DefaultScopedCell from '../../components/issue-558/DefaultScopedCell/index.vue'
import Issue558NestedSlotCell from '../../components/issue-558/Issue558NestedSlotCell/index.vue'
import Issue558NestedSlotGroup from '../../components/issue-558/Issue558NestedSlotGroup/index.vue'
import ListScopedCell from '../../components/issue-558/ListScopedCell/index.vue'
import NamedSlotCard from '../../components/issue-558/NamedSlotCard/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-558',
})

function func(text: string = '') {
  return text.split('').reverse().join('')
}

const text = '123456789'
const headerText = 'header'
const defaultText = 'default'
const nestedText = 'nested'
const visible = true

function _runE2E() {
  const defaultScopedLabel = 'scoped-default'
  const defaultScopedCount = 2
  const namedFooterSuffix = '-footer'
  const listRows = [
    { label: 'alpha' },
    { label: 'beta' },
  ]

  return {
    ok: true,
    cases: {
      plainDefault: func(text),
      namedHeader: func(headerText),
      explicitDefault: func(defaultText),
      namedScopedFooter: func(text + namedFooterSuffix),
      defaultScoped: func(`${defaultScopedLabel}-${defaultScopedCount}-${text}`),
      listScoped: listRows.map((item, index) => func(`${item.label}-${index}-${text}`)),
      nestedDefault: func(nestedText),
    },
  }
}
</script>

<template>
  <view class="issue558-page">
    <view class="issue558-title">
      issue-558 augmented slot computed binding
    </view>

    <Cell>
      <text
        class="issue558-result"
        data-issue558-case="plain-default"
      >
        {{ func(text) }}
      </text>
    </Cell>

    <NamedSlotCard>
      <template #header>
        <text
          class="issue558-result"
          data-issue558-case="named-header"
        >
          {{ func(headerText) }}
        </text>
      </template>

      <template #default>
        <text
          class="issue558-result"
          data-issue558-case="explicit-default"
        >
          {{ func(defaultText) }}
        </text>
      </template>

      <template #footer="{ suffix }">
        <text
          class="issue558-result"
          data-issue558-case="named-scoped-footer"
        >
          {{ func(text + suffix) }}
        </text>
      </template>
    </NamedSlotCard>

    <DefaultScopedCell v-slot="{ label, count }">
      <text
        v-if="visible"
        class="issue558-result"
        data-issue558-case="default-scoped"
      >
        {{ func(`${label}-${count}-${text}`) }}
      </text>
    </DefaultScopedCell>

    <ListScopedCell v-slot="{ item, index }">
      <text
        class="issue558-result"
        :data-issue558-case="`list-scoped-${index}`"
      >
        {{ func(`${item.label}-${index}-${text}`) }}
      </text>
    </ListScopedCell>

    <Issue558NestedSlotGroup>
      <Issue558NestedSlotCell>
        <text
          class="issue558-result"
          data-issue558-case="nested-default"
        >
          {{ func(nestedText) }}
        </text>
      </Issue558NestedSlotCell>
    </Issue558NestedSlotGroup>
  </view>
</template>

<style scoped>
.issue558-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #fff;
}

.issue558-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.issue558-result {
  display: block;
  font-size: 28rpx;
  color: #111827;
}
</style>
