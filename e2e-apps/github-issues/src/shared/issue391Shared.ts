export const issue391SharedSentinel = 'issue-391-shared-sentinel'

export function issue391SharedMessage(scope: string) {
  return `${issue391SharedSentinel}:${scope}`
}
