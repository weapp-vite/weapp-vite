<script lang="ts">
export default {
  data() {
    return {
      username: '',
      password: '',
      gender: 'male',
      hobbies: [] as string[],
      agree: false,
      city: '北京',
    }
  },
  methods: {
    onUsernameInput(e: any) {
      this.username = e.detail.value
    },
    onPasswordInput(e: any) {
      this.password = e.detail.value
    },
    onGenderChange(e: any) {
      this.gender = e.detail.value
    },
    onHobbyChange(e: any) {
      this.hobbies = e.detail.value
    },
    onAgreeChange(e: any) {
      this.agree = e.detail.value
    },
    onCityChange(e: any) {
      this.city = e.detail.value
    },
    handleSubmit() {
      const data = {
        username: this.username,
        gender: this.gender,
        hobbies: this.hobbies,
        city: this.city,
        agree: this.agree,
      }
      wx.showModal({
        title: '表单数据',
        content: JSON.stringify(data, null, 2),
        showCancel: false,
      })
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      表单绑定
    </view>

    <view class="section">
      <view class="section-title">
        文本输入
      </view>
      <view class="form-item">
        <text class="form-label">
          用户名
        </text>
        <input class="form-input" value="{{username}}" bindinput="onUsernameInput" placeholder="请输入用户名">
      </view>
      <view class="form-item">
        <text class="form-label">
          密码
        </text>
        <input class="form-input" type="password" value="{{password}}" bindinput="onPasswordInput" placeholder="请输入密码">
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        单选按钮
      </view>
      <radio-group bindchange="onGenderChange">
        <label class="radio-item">
          <radio value="male" checked="{{gender === 'male'}}" />
          <text>男</text>
        </label>
        <label class="radio-item">
          <radio value="female" checked="{{gender === 'female'}}" />
          <text>女</text>
        </label>
      </radio-group>
    </view>

    <view class="section">
      <view class="section-title">
        多选框
      </view>
      <checkbox-group bindchange="onHobbyChange">
        <label class="checkbox-item">
          <checkbox value="reading" />
          <text>阅读</text>
        </label>
        <label class="checkbox-item">
          <checkbox value="music" />
          <text>音乐</text>
        </label>
        <label class="checkbox-item">
          <checkbox value="sports" />
          <text>运动</text>
        </label>
      </checkbox-group>
    </view>

    <view class="section">
      <view class="section-title">
        开关
      </view>
      <view class="form-item">
        <text class="form-label">
          同意协议
        </text>
        <switch checked="{{agree}}" bindchange="onAgreeChange" />
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        数据预览
      </view>
      <view class="preview">
        <text class="preview-item">
          用户名: {{ username || '(未填写)' }}
        </text>
        <text class="preview-item">
          性别: {{ gender === 'male' ? '男' : '女' }}
        </text>
        <text class="preview-item">
          爱好: {{ hobbies.join(', ') || '(未选择)' }}
        </text>
        <text class="preview-item">
          同意协议: {{ agree ? '是' : '否' }}
        </text>
      </view>
    </view>

    <button class="btn btn-primary submit-btn" @click="handleSubmit">
      提交表单
    </button>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.form-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #eee;
}

.form-label {
  font-size: 28rpx;
  color: #333;
}

.form-input {
  flex: 1;
  margin-left: 24rpx;
  padding: 16rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.radio-item,
.checkbox-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}

.radio-item text,
.checkbox-item text {
  margin-left: 16rpx;
  font-size: 28rpx;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.preview-item {
  padding: 16rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #666;
}

.submit-btn {
  margin-top: 48rpx;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "表单绑定"
}
</json>
