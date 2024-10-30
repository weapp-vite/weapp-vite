import share from '@/assets/share'
import { definePageJson } from 'weapp-vite/json'

export default definePageJson((ctx) => {
  return {
    $schema: 'https://vite.icebreaker.top/page.json',
    usingComponents: {},
    ...share,
    platform: ctx.platform,
  }
})
