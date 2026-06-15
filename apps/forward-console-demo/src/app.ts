/* eslint-disable no-console -- 此 demo 专门验证小程序日志转发到命令行。 */

App({
  globalData: {
    appName: 'forward-console-demo',
  },
  onLaunch() {
    console.info('[forward-console-demo] app launched')
  },
})
