import { I18n, setLocale, t } from 'weapp-vite/i18n'

Component({
  behaviors: [I18n],
  data: {
    user: { name: 'Native' },
  },
  lifetimes: {
    attached() {
      setLocale('en-US')
      this.setData({ logicText: t('issue845.greeting', this.data) })
    },
  },
})
