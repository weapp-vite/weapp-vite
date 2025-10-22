import { buildRootOnlyMessage } from '@/utils/rootOnly'

Page({
  data: {
    message: buildRootOnlyMessage('packageA'),
  },
  onLoad() {
    console.log('packageA foo ready')
  },
})
