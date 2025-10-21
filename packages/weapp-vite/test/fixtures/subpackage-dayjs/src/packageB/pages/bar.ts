import dayjs from 'dayjs'
import { buildSharedMessage } from '../../shared/utils'

const baseline = dayjs('2000-01-01T00:00:00')

Page({
  data: {
    shared: buildSharedMessage('packageB'),
    formattedBaseline: baseline.format('YYYY-MM-DD'),
    plusSevenDays: baseline.add(7, 'day').format('YYYY-MM-DD'),
  },
  onLoad() {
    console.log('packageB bar loaded')
  },
})
