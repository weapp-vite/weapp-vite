import type { DashboardTokenGroup, DashboardTokenSwatchItem } from '../types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { copyText } from '../utils/clipboard'

export type TokenGroupFilter = 'all' | DashboardTokenGroup['title']

interface TokenInspectorItem extends DashboardTokenSwatchItem {
  key: string
  groupTitle: DashboardTokenGroup['title']
  groupIconName: DashboardTokenGroup['iconName']
}

interface TokenInspectorProps {
  groups: DashboardTokenGroup[]
}

export function useTokenInspector(props: TokenInspectorProps) {
  const searchQuery = ref('')
  const groupFilter = ref<TokenGroupFilter>('all')
  const selectedTokenKey = ref<string | null>(null)
  const copiedToken = ref<string | null>(null)
  const failedToken = ref<string | null>(null)
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

  const allTokens = computed<TokenInspectorItem[]>(() =>
    props.groups.flatMap(group =>
      group.tokens.map(token => ({
        ...token,
        key: `${group.title}:${token.name}`,
        groupTitle: group.title,
        groupIconName: group.iconName,
      })),
    ),
  )

  const groupOptions = computed(() => [
    { value: 'all', label: '全部分组' },
    ...props.groups.map(group => ({ value: group.title, label: group.title })),
  ])

  const filteredTokens = computed(() => {
    const keyword = searchQuery.value.trim().toLowerCase()

    return allTokens.value.filter((token) => {
      if (groupFilter.value !== 'all' && token.groupTitle !== groupFilter.value) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        token.name,
        token.sample,
        token.groupTitle,
      ].join(' ').toLowerCase().includes(keyword)
    })
  })

  const selectedToken = computed(() =>
    filteredTokens.value.find(token => token.key === selectedTokenKey.value)
    ?? filteredTokens.value[0]
    ?? null,
  )

  const tokenSummary = computed(() => {
    const groupText = groupFilter.value === 'all' ? '全部' : groupFilter.value
    return `匹配 ${filteredTokens.value.length} / ${allTokens.value.length} 个令牌 · ${groupText}`
  })

  const selectedSampleStyle = computed(() => ({
    background: selectedToken.value?.sample ?? 'transparent',
  }))

  function clearCopyFeedback() {
    copiedToken.value = null
    failedToken.value = null
  }

  function scheduleCopyFeedbackClear() {
    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer)
    }

    copyFeedbackTimer = setTimeout(() => {
      clearCopyFeedback()
      copyFeedbackTimer = null
    }, 1800)
  }

  async function copyToken(text: string) {
    try {
      await copyText(text)
      copiedToken.value = text
      failedToken.value = null
    }
    catch {
      copiedToken.value = null
      failedToken.value = text
    }

    scheduleCopyFeedbackClear()
  }

  watch(filteredTokens, (tokens) => {
    if (!tokens.some(token => token.key === selectedTokenKey.value)) {
      selectedTokenKey.value = tokens[0]?.key ?? null
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer)
    }
  })

  return {
    copiedToken,
    copyToken,
    failedToken,
    filteredTokens,
    groupFilter,
    groupOptions,
    searchQuery,
    selectedSampleStyle,
    selectedToken,
    selectedTokenKey,
    tokenSummary,
  }
}
