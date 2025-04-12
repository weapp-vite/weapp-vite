const utils = require('./utils')

worker.onMessage((res) => {
  console.log(res, utils)
})
