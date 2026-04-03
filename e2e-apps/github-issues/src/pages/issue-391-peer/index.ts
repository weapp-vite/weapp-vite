import { issue391SharedMessage, issue391SharedSentinel } from '../../shared/issue391Shared'

Page({
  data: {
    title: 'issue-391 peer',
    marker: 'issue-391-peer-marker',
    message: issue391SharedMessage('peer'),
    sentinel: issue391SharedSentinel,
  },
})
