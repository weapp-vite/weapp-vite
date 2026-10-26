const apiNames = ['login', 'getAccountInfoSync', 'arrayBufferToBase64', 'base64ToArrayBuffer']

function observeCall(name, args) {
  try {
    const result = wx[name](...args)
    if (Object.prototype.toString.call(result) === '[object ArrayBuffer]') {
      return { type: 'ArrayBuffer', bytes: Array.from(new Uint8Array(result)) }
    }
    return { type: typeof result, value: result }
  }
  catch (error) {
    return { threw: true, name: error.name, message: error.message }
  }
}

function observeBinary() {
  const bytes = Array.from({ length: 256 }, (_, index) => index)
  const buffers = [[], [0], [0, 255], [0, 127, 255], bytes]
  const roundTrips = buffers.map((values) => {
    const encoded = observeCall('arrayBufferToBase64', [new Uint8Array(values).buffer])
    const decoded = encoded.type === 'string'
      ? observeCall('base64ToArrayBuffer', [encoded.value])
      : undefined
    return { input: values, encoded, decoded }
  })
  return { roundTrips }
}

function observeAccount() {
  try {
    const result = wx.getAccountInfoSync()
    return {
      miniProgram: {
        appId: result.miniProgram.appId,
        envVersion: result.miniProgram.envVersion,
        version: result.miniProgram.version,
      },
      plugin: result.plugin,
    }
  }
  catch (error) {
    return { threw: true, name: error.name, message: error.message }
  }
}

function observeLogin() {
  return new Promise((resolve) => {
    const order = ['before-call']
    const observation = { order }
    try {
      const returned = wx.login({
        timeout: 10_000,
        success(result) {
          order.push('success')
          observation.success = { hasCode: typeof result.code === 'string' && result.code.length > 0, errMsg: result.errMsg }
        },
        fail(result) {
          order.push('fail')
          observation.failure = { errMsg: result.errMsg }
        },
        complete(result) {
          order.push('complete')
          observation.complete = { errMsg: result.errMsg }
          resolve(observation)
        },
      })
      observation.returnType = typeof returned
      order.push('after-call')
    }
    catch (error) {
      observation.threw = { name: error.name, message: error.message }
      resolve(observation)
    }
  })
}

async function observeContract() {
  const available = apiNames.map(name => typeof wx[name])
  const account = observeAccount()
  const binary = observeBinary()
  const login = await observeLogin()
  return { available, login, account, binary }
}

Page({
  data: {
    apiStatus: 'pending',
    loginStatus: 'pending',
    loginOrder: 'pending',
    accountStatus: 'pending',
    binaryStatus: 'pending',
    emptyStatus: 'pending',
  },
  async _runContract() {
    const result = await observeContract()
    const miniProgram = result.account.miniProgram
    const roundTrips = result.binary.roundTrips
    this.setData({
      apiStatus: result.available.every(type => type === 'function') ? 'available' : 'missing',
      loginStatus: result.login.success?.hasCode ? 'success' : 'failed',
      loginOrder: result.login.order.join(','),
      accountStatus: miniProgram && typeof miniProgram.appId === 'string' && miniProgram.appId.length > 0
        && ['develop', 'trial', 'release'].includes(miniProgram.envVersion) && typeof miniProgram.version === 'string'
        ? 'valid'
        : 'invalid',
      binaryStatus: roundTrips.every(item => JSON.stringify(item.input) === JSON.stringify(item.decoded?.bytes)) ? 'round-trip' : 'failed',
      emptyStatus: roundTrips[0].encoded.value === '' && roundTrips[0].decoded?.bytes.length === 0 ? 'empty-round-trip' : 'failed',
    })
    return result
  },
})
