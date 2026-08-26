import { wpi } from 'wevu/api'

function verifyWpiFailErrorTypes() {
  wpi.openBluetoothAdapter({
    fail(error) {
      const errno: number | undefined = error.errno
      const errCode: number = error.errCode
      void errno
      void errCode
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

void verifyWpiFailErrorTypes

Page({})
