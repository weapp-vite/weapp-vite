import { computed, ref } from 'wevu'

const issue340Seed = ref('issue-340-hoist')

export function useIssue340SharedMessage(scope: string) {
  const scoped = computed(() => `${scope}:${issue340Seed.value}:shared`)

  function readMessage() {
    return scoped.value
  }

  return {
    readMessage,
  }
}
