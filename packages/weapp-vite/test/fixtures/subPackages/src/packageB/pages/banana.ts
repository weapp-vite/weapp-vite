import { formatTime } from '@/utils/util'

console.log('banana')
Component({
  data: {
    now: formatTime(new Date()),
    name: import.meta.env.VITE_SUB_PACKAGE_B
  },
})
