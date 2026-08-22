import { I18nPage, setLocale, t } from 'weapp-vite/i18n'

I18nPage({
  data: {
    user: { name: 'Native' },
  },
  onLoad() {
    setLocale('en-US')
    this.setData({ logicText: t('issue845.greeting', this.data) })
  },
})
