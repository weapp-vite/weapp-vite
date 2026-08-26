import { wpi } from 'wevu/api'

function verifyWpiCallbackTypes() {
  wpi.openBluetoothAdapter({
    success(result) {
      const errMsg: string = result.errMsg
      void errMsg
    },
    fail(error) {
      const errno: number | undefined = error.errno
      const errCode: number = error.errCode
      void errno
      void errCode
    },
    complete(result) {
      const errMsg: string = result.errMsg
      void errMsg
    },
  }).catch((error) => {
    const errno: number | undefined = error.errno
    const errCode: number = error.errCode
    void errno
    void errCode
  })

  wpi.createBLEConnection({
    deviceId: 'issue-879-device',
    fail(error) {
      const errno: number | undefined = error.errno
      const errCode: number = error.errCode
      void errno
      void errCode
    },
  })
}

void verifyWpiCallbackTypes

Page({})
