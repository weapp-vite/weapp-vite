<script setup lang="ts">
import Toast from 'tdesign-miniprogram/toast/index'
import { onLoad, ref, useNativeInstance } from 'wevu'
import { fetchPerson } from '../../../services/usercenter/fetchPerson'
import { phoneEncryption } from '../../../utils/util'

interface PersonInfo {
  avatarUrl: string
  nickName: string
  gender: number
  phoneNumber: string
}

const nativeInstance = useNativeInstance() as any

const personInfo = ref<PersonInfo>({
  avatarUrl: '',
  nickName: '',
  gender: 0,
  phoneNumber: '',
})

const pickerOptions = ref([
  {
    name: '男',
    code: 1,
  },
  {
    name: '女',
    code: 2,
  },
])

const typeVisible = ref(false)
const genderMap = ref(['', '男', '女'])

function showToast(message: string, theme: 'success' | 'error' = 'success') {
  Toast({
    context: nativeInstance,
    selector: '#t-toast',
    message,
    theme,
  })
}

async function fetchData() {
  const nextPersonInfo = await fetchPerson() as Partial<PersonInfo>
  const encryptedPhone = phoneEncryption(String(nextPersonInfo.phoneNumber || ''))
  personInfo.value = {
    ...personInfo.value,
    ...nextPersonInfo,
    gender: Number(nextPersonInfo.gender || 0),
    phoneNumber: encryptedPhone,
  }
}

function init() {
  void fetchData()
}

async function toModifyAvatar() {
  try {
    const tempFilePath = await new Promise<string>((resolve, reject) => {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const file = res.tempFiles?.[0]
          if (!file?.path) {
            reject(new Error('未获取到图片文件'))
            return
          }
          if (file.size <= 10 * 1024 * 1024) {
            resolve(file.path)
            return
          }
          reject(new Error('图片大小超出限制，请重新上传'))
        },
        fail: (err: any) => {
          const message = err?.errMsg || err?.message || String(err)
          reject(new Error(message))
        },
      })
    })

    const tempUrlArr = tempFilePath.split('/')
    const tempFileName = tempUrlArr[tempUrlArr.length - 1] || tempFilePath
    showToast(`已选择图片-${tempFileName}`)
  }
  catch (error: any) {
    if (error?.message === 'chooseImage:fail cancel') {
      return
    }
    showToast(error?.message || error?.errMsg || error?.msg || '修改头像出错了', 'error')
  }
}

function onClickCell({ currentTarget }: any) {
  const type = currentTarget?.dataset?.type
  const nickName = personInfo.value.nickName || ''

  switch (type) {
    case 'gender':
      typeVisible.value = true
      break
    case 'name':
      wx.navigateTo({
        url: `/pages/user/name-edit/index?name=${nickName}`,
      })
      break
    case 'avatarUrl':
      void toModifyAvatar()
      break
    default:
      break
  }
}

function onClose() {
  typeVisible.value = false
}

function onConfirm(e: any) {
  const value = Number(e?.detail?.value || 0)
  typeVisible.value = false
  personInfo.value = {
    ...personInfo.value,
    gender: value,
  }
  showToast('设置成功')
}

function openUnbindConfirm() {
  wx.showModal({
    title: '提示',
    content: '当前模板暂未接入账号切换流程',
    showCancel: false,
  })
}

onLoad(() => {
  init()
})

defineExpose({
  personInfo,
  pickerOptions,
  typeVisible,
  genderMap,
  onClickCell,
  onClose,
  onConfirm,
  openUnbindConfirm,
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
