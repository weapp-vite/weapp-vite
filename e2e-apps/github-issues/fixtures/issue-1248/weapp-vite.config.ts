import { defineConfig } from 'weapp-vite'
import { fixture } from './fixtureConfig'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    web: {
      enable: true,
      pluginOptions: {
        wxss: fixture.wxss,
        runtime: { viewport: { mode: 'mini-program', maxWidth: 400, desktopBreakpoint: 800 } },
      },
    },
  },
})
