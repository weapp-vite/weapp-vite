import { wpi } from 'wevu/api'

export default () => {
  if (!wpi.canIUse('getUpdateManager')) {
    return
  }

  const updateManager = wpi.getUpdateManager()

  updateManager.onUpdateReady(async () => {
    const res = await wpi.showModal({
      title: '更新提示',
      content: '新版本已经准备好，是否重启应用？',
    })
    if (res.confirm) {
      // 新的版本已经下载好，调用 applyUpdate 应用新版本并重启
      updateManager.applyUpdate()
    }
  })

  updateManager.onUpdateFailed(() => {
    // 新版本下载失败
  })
}
