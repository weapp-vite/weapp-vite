import { definePageJson } from 'weapp-vite/json'

export default definePageJson((ctx) => {
  console.log(ctx.platform)
  return {
    usingComponents: {},
    platform: ctx.platform,
  }
})
