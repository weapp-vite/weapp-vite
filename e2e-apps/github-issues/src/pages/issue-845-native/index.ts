import { i18n } from 'weapp-vite/i18n'

Component({
  behaviors: [i18n.behavior],
  data: {
    user: { name: 'Native' },
  },
  lifetimes: {
    attached() {
      i18n.global.locale = 'en-US'
      this.setData({ logicText: i18n.global.t('issue845.greeting', this.data) })
    },
  },
})
