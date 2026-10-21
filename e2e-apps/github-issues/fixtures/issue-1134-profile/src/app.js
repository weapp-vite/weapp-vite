import appConfig from './app.json'
import plainConfig from './pages/plain/index.json'

App({
  fixtureConfig: {
    pages: appConfig.pages,
    plainUsingComponents: plainConfig.usingComponents ?? {},
  },
})
