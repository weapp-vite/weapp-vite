<script lang="ts">
import Toast from 'tdesign-miniprogram/toast/index'
import { fetchPerson } from '../../../services/usercenter/fetchPerson'
import { phoneEncryption } from '../../../utils/util'

Page({
  data: {
    personInfo: {
      avatarUrl: '',
      nickName: '',
      gender: 0,
      phoneNumber: '',
    },
    showUnbindConfirm: false,
    pickerOptions: [
      {
        name: '男',
        code: '1',
      },
      {
        name: '女',
        code: '2',
      },
    ],
    typeVisible: false,
    genderMap: ['', '男', '女'],
  },
  onLoad() {
    this.init()
  },
  init() {
    this.fetchData()
  },
  fetchData() {
    fetchPerson().then((personInfo) => {
      this.setData({
        personInfo,
        'personInfo.phoneNumber': phoneEncryption(personInfo.phoneNumber),
      })
    })
  },
  onClickCell({ currentTarget }) {
    const { dataset } = currentTarget
    const { nickName } = this.data.personInfo

    switch (dataset.type) {
      case 'gender':
        this.setData({
          typeVisible: true,
        })
        break
      case 'name':
        wx.navigateTo({
          url: `/pages/user/name-edit/index?name=${nickName}`,
        })
        break
      case 'avatarUrl':
        this.toModifyAvatar()
        break
      default: {
        break
      }
    }
  },
  onClose() {
    this.setData({
      typeVisible: false,
    })
  },
  onConfirm(e) {
    const { value } = e.detail
    this.setData(
      {
        'typeVisible': false,
        'personInfo.gender': value,
      },
      () => {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '设置成功',
          theme: 'success',
        })
      },
    )
  },
  async toModifyAvatar() {
    try {
      const tempFilePath = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (res) => {
            const { path, size } = res.tempFiles[0]
            if (size <= 10485760) {
              resolve(path)
            }
            else {
              reject({ errMsg: '图片大小超出限制，请重新上传' })
            }
          },
          fail: err => reject(err),
        })
      })
      const tempUrlArr = tempFilePath.split('/')
      const tempFileName = tempUrlArr[tempUrlArr.length - 1]
      Toast({
        context: this,
        selector: '#t-toast',
        message: `已选择图片-${tempFileName}`,
        theme: 'success',
      })
    }
    catch (error) {
      if (error.errMsg === 'chooseImage:fail cancel') { return }
      Toast({
        context: this,
        selector: '#t-toast',
        message: error.errMsg || error.msg || '修改头像出错了',
        theme: 'error',
      })
    }
  },
})
</script>

<template>
<view class="person-info [padding-top:20rpx] [&_.order-group__left]:[margin-right:0] [&_.t-cell-class]:[height:112rpx]">
  <t-cell-group>
    <t-cell
      title="头像"
      center="{{true}}"
      data-type="avatarUrl"
      bind:click="onClickCell"
      arrow
      t-class-left="order-group__left"
    >
      <t-image slot="note" src="{{personInfo.avatarUrl}}" t-class="avatarUrl [width:80rpx] [height:80rpx] ![border-radius:50%] [overflow:hidden]" mode="aspectFill" />
    </t-cell>
    <t-cell
      title="昵称"
      arrow
      note="{{personInfo.nickName}}"
      data-type="name"
      bind:click="onClickCell"
      t-class="t-cell-class"
      t-class-left="order-group__left"
    />
    <t-cell
      title="性别"
      arrow
      note="{{genderMap[personInfo.gender]}}"
      data-type="gender"
      bind:click="onClickCell"
      t-class="t-cell-class"
      t-class-left="order-group__left"
    />
    <t-cell
      bordered="{{false}}"
      title="手机号"
      arrow
      note="{{personInfo.phoneNumber ? personInfo.phoneNumber : '去绑定手机号'}}"
      data-type="phoneNumber"
      bind:click="onClickCell"
      t-class="t-cell-class"
      t-class-left="order-group__left"
    />
  </t-cell-group>
</view>
<view class="person-info__wrapper [width:100%] [padding:0_32rpx] [padding-bottom:calc(env(safe-area-inset-bottom)_+_20rpx)] [position:absolute] [bottom:0] [left:0]">
  <view class="person-info__btn [width:100%] [border:2rpx_solid_#ddd] [border-radius:48rpx] [padding:18rpx_0] [display:flex] [align-self:center] [justify-content:center]" bind:tap="openUnbindConfirm"> 切换账号登录 </view>
</view>
<t-select-picker
  show="{{typeVisible}}"
  picker-options="{{pickerOptions}}"
  title="选择性别"
  value="{{personInfo.gender}}"
  bind:confirm="onConfirm"
  bind:close="onClose"
/>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "个人资料",
  "usingComponents": {
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-button": "tdesign-miniprogram/button/button",
    "t-image": "/components/webp-image/index",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-select-picker": "../../usercenter/components/ui-select-picker/index"
  }
}
</json>
