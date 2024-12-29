import Toast from 'tdesign-miniprogram/toast/index'

Component({
  data: {
    motto: 'Hello World',
    userInfo: {
      nickName: '',
    },
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
  },
  methods: {
    showSuccessToast() {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '成功文案',
        theme: 'success',
        direction: 'column',
      })
    },
  },
})
