import Message from 'tdesign-miniprogram/message/index'
import Toast from 'tdesign-miniprogram/toast/index'

Component({
  properties: {
    subtitle: String,
    title: String,
  },
  methods: {
    showLayoutToast(options: { message: string, theme?: 'success' | 'warning' | 'error' | 'info' }) {
      Toast({
        context: this,
        selector: '#layout-toast',
        message: options.message,
        theme: options.theme === 'info' ? undefined : options.theme,
        duration: 1400,
      })
    },
    showLayoutMessage(options: { message: string, theme?: 'success' | 'warning' | 'error' | 'info' }) {
      const theme = options.theme ?? 'info'
      Message[theme]({
        context: this,
        selector: '#layout-message',
        content: options.message,
        duration: 1800,
        single: true,
      })
    },
  },
})
