import clsx from 'clsx'
import dayjs from 'dayjs'

Page({
  data: {
    className: clsx('package-a', 'ready'),
    formattedNow: dayjs('2024-01-01').format('YYYY-MM-DD'),
  },
})
