import dayjs from 'dayjs'

import relativeTime from 'dayjs/plugin/relativeTime.js'

dayjs.extend(relativeTime)

Page({
  onLoad(query) {
    console.log('query', query, dayjs())
  },
})
