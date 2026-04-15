import { formatTime } from '../../utils/util'
import { prepareWorker } from './worker'

const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
const workerPath = 'workers/index.js'
let activeWorker: { terminate?: () => void } | undefined

function formatWorkerMessage(payload: unknown) {
  if (typeof payload === 'string') {
    return payload
  }
  try {
    return JSON.stringify(payload)
  }
  catch {
    return String(payload)
  }
}

Component({
  data: {
    motto: 'Hello World',
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    ss: formatTime(new Date()),
    workerStatus: 'idle',
    workerMessage: '未初始化',
  },
  lifetimes: {
    ready() {
      void this.setupWorker()
    },
  },
  methods: {
    async setupWorker() {
      if (typeof activeWorker?.terminate === 'function') {
        activeWorker.terminate()
        activeWorker = undefined
      }

      this.setData({
        workerStatus: 'loading',
        workerMessage: '正在初始化 worker',
      })

      const result = await prepareWorker(wx, {
        workerPath,
        workerSubpackage: true,
      })

      if (result.status !== 'ready' || !result.worker) {
        this.setData({
          workerStatus: result.status,
          workerMessage: result.detail,
        })
        return
      }

      const worker = result.worker
      activeWorker = worker
      this.setData({
        workerStatus: 'created',
        workerMessage: result.detail,
      })

      worker.onMessage((payload) => {
        this.setData({
          workerStatus: 'ready',
          workerMessage: formatWorkerMessage(payload),
        })
      })

      if (typeof worker.onError === 'function') {
        worker.onError((error) => {
          this.setData({
            workerStatus: 'error',
            workerMessage: formatWorkerMessage(error),
          })
        })
      }

      if (typeof worker.onProcessKilled === 'function') {
        worker.onProcessKilled(() => {
          this.setData({
            workerStatus: 'restarting',
            workerMessage: 'worker 进程被回收，准备重建',
          })
          activeWorker = undefined
          void this.setupWorker()
        })
      }
    },
    bindViewTap() {
      wx.navigateTo({
        url: '../logs/logs',
      })
    },
    onChooseAvatar(e: any) {
      const { avatarUrl } = e.detail
      const { nickName } = this.data.userInfo
      this.setData({
        'userInfo.avatarUrl': avatarUrl,
        'hasUserInfo': nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
      })
    },
    onInputChange(e: any) {
      const nickName = e.detail.value
      const { avatarUrl } = this.data.userInfo
      this.setData({
        'userInfo.nickName': nickName,
        'hasUserInfo': nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
      })
    },
    getUserProfile() {
      wx.getUserProfile({
        desc: '展示用户信息',
        success: (res) => {
          console.log(res)
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true,
          })
        },
      })
    },
  },
})
