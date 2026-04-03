import { issue391SharedMessage, issue391SharedSentinel } from '../../shared/issue391Shared'

Page({
  data: {
    title: 'issue-391 primary',
    marker: 'issue-391-initial-marker',
    message: issue391SharedMessage('primary'),
    sentinel: issue391SharedSentinel,
  },
})
