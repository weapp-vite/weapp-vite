import type { Page } from 'weapp-vite/json'
import share from '@/assets/share'

export default <Page>{
  $schema: 'https://ice-vite.netlify.app/page.json',
  usingComponents: {},
  ...share,
  // platform: ctx.platform,
}
