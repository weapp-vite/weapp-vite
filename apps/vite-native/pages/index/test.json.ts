import type { Page } from 'weapp-vite/json'
import share from '@/assets/share'

export default <Page>{
  $schema: 'https://vite.weapp.dev/page.json',
  usingComponents: {},
  ...share,
  // platform: ctx.platform,
}
