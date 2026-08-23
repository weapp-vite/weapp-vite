import { i18n } from 'weapp-vite/i18n'

Component({
  behaviors: [i18n.behavior],
  data: {
    user: { name: 'Independent' },
  },
})
