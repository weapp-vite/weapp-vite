import dayjs from 'dayjs'
import { buildSharedMessage } from '../../shared/utils'

const now = dayjs()

Page({
  data: {
    shared: buildSharedMessage('packageA'),
    formattedNow: now.format('YYYY-MM-DD HH:mm:ss'),
    tomorrow: now.add(1, 'day').format('YYYY-MM-DD'),
  },
  onLoad() {
    console.log('packageA foo loaded')
  },
})
