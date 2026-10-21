const appConfig = require('./app.json')
const plainConfig = require('./pages/plain/index.json')

App({
  fixtureConfig: {
    pages: appConfig.pages,
    plainUsingComponents: plainConfig.usingComponents ?? {},
  },
})
