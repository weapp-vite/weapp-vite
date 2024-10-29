import type { Page } from 'weapp-vite/json'
import xxx from '@/assets/share'
import shared from './shared.json'

console.log(import.meta.env)

export default <Page>{
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-divider': 'tdesign-miniprogram/divider/divider',
    'ice-avatar': '@/avatar/avatar',
  },
  ...shared,
  ...xxx,
}
