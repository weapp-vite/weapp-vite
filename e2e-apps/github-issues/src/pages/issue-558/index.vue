<script setup lang="ts">
import Cell from '../../components/issue-558/Cell/index.vue'
import DefaultScopedCell from '../../components/issue-558/DefaultScopedCell/index.vue'
import Issue558NestedSlotCell from '../../components/issue-558/Issue558NestedSlotCell/index.vue'
import Issue558NestedSlotGroup from '../../components/issue-558/Issue558NestedSlotGroup/index.vue'
import ListScopedCell from '../../components/issue-558/ListScopedCell/index.vue'
import NamedSlotCard from '../../components/issue-558/NamedSlotCard/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-558',
  usingComponents: {
    'issue-558-render-probe': '/components/issue-558/Issue558RenderProbe/index',
  },
})

function func(text: string = '') {
  return text.split('').reverse().join('')
}

const text = '123456789'
const headerText = 'header'
const defaultText = 'default'
const nestedText = 'nested'
const visible = true

const expectedRenderedCases = {
  plainDefault: '987654321',
  namedHeader: 'redaeh',
  explicitDefault: 'tluafed',
  namedScopedFooter: 'retoof-987654321',
  defaultScoped: '987654321-2-tluafed-depocs',
  listScoped: [
    '987654321-0-ahpla',
    '987654321-1-ateb',
  ],
  nestedOuter: 'retuo',
  nestedDefault: 'detsen',
}

function _runE2E() {
  const pages = getCurrentPages() as Array<Record<string, any>>
  const currentPage = pages[pages.length - 1]
  const renderedCases = { ...(currentPage?.__issue558RenderedCases ?? {}) }
  const ok = Object.entries(expectedRenderedCases).every(([caseName, expected]) => {
    const rendered = renderedCases[caseName]
    return Array.isArray(expected)
      ? Array.isArray(rendered) && expected.every((value, index) => rendered[index] === value)
      : rendered === expected
  })

  return {
    ok,
    cases: renderedCases,
  }
}
</script>

<template>
  <view class="issue558-page">
    <view class="issue558-title">
      issue-558 augmented slot computed binding
    </view>

    <Cell>
      <issue-558-render-probe
        case-name="plainDefault"
        :value="func(text)"
      />
    </Cell>

    <NamedSlotCard>
      <template #header>
        <issue-558-render-probe
          case-name="namedHeader"
          :value="func(headerText)"
        />
      </template>

      <template #default>
        <issue-558-render-probe
          case-name="explicitDefault"
          :value="func(defaultText)"
        />
      </template>

      <template #footer="{ suffix }">
        <issue-558-render-probe
          case-name="namedScopedFooter"
          :value="func(text + suffix)"
        />
      </template>
    </NamedSlotCard>

    <DefaultScopedCell v-slot="{ label, count }">
      <issue-558-render-probe
        v-if="visible"
        case-name="defaultScoped"
        :value="func(`${label}-${count}-${text}`)"
      />
    </DefaultScopedCell>

    <ListScopedCell v-slot="{ item, index }">
      <issue-558-render-probe
        case-name="listScoped"
        :value="func(`${item.label}-${index}-${text}`)"
      />
    </ListScopedCell>

    <Issue558NestedSlotGroup>
      <issue-558-render-probe
        case-name="nestedOuter"
        :value="func('outer')"
      />
      <Issue558NestedSlotCell>
        <issue-558-render-probe
          case-name="nestedDefault"
          :value="func(nestedText)"
        />
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
