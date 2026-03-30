import { cva } from 'class-variance-authority'
import dayjs from 'dayjs'

const button = cva('button', {
  variants: {
    tone: {
      primary: 'button-primary',
    },
  },
})

Page({
  data: {
    buttonClass: button({ tone: 'primary' }),
    formattedNow: dayjs('2024-01-02').format('YYYY-MM-DD'),
  },
})
