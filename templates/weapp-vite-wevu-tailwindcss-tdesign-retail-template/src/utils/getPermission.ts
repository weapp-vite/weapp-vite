// @ts-nocheck
import { wpi } from '@wevu/api'

interface PermissionOptions {
  code: string
  name: string
}

export async function getPermission({ code, name }: PermissionOptions) {
  const res = await wpi.getSetting()
  if (res.authSetting[code] !== false) {
    return
  }

  const modalRes = await wpi.showModal({
    title: `获取${name}失败`,
    content: `获取${name}失败，请在【右上角】-小程序【设置】项中，将【${name}】开启。`,
    confirmText: '去设置',
    confirmColor: '#FA550F',
    cancelColor: '取消',
  })

  if (!modalRes.confirm) {
    throw new Error(`用户取消开启${name}权限`)
  }

  const settingRes = await wpi.openSetting()
  if (settingRes.authSetting[code] === true) {
    return
  }

  console.warn('用户未打开权限', name, code)
  throw new Error(`用户未开启${name}权限`)
}
