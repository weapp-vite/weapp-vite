<script setup lang="ts">
defineOptions({
  options: {
    addGlobalClass: true
  },
  properties: {
    show: Boolean,
    title: String,
    options: {
      type: Object,
      observer() {
        this.init();
      }
    },
    multiple: {
      type: Boolean,
      observer() {
        this.init();
      }
    },
    showConfirmButton: Boolean,
    showCloseButton: Boolean,
    confirmButtonText: {
      type: String,
      value: '确定'
    },
    cancelButtonText: {
      type: String,
      value: '取消'
    },
    emptyTip: {
      type: String,
      value: '请选择'
    }
  },
  data() {
    return {
      _options: [],
      checkedIndexes: []
    };
  },
  methods: {
    attached() {
      this.toast = this.selectComponent('#t-toast');
    },
    init() {
      const checkedIndexes = [];
      const _options = this.properties.options.map((opt, i) => {
        const checked = !!opt.checked;
        if (checked) {
          if (this.properties.multiple) checkedIndexes[0] = i;else checkedIndexes.push(i);
        }
        return {
          title: opt.title,
          checked
        };
      });
      this.setData({
        checkedIndexes,
        _options
      });
    },
    onOptionTap(e) {
      const {
        index
      } = e.currentTarget.dataset;
      const {
        checkedIndexes
      } = this.data;
      let data = {};
      if (this.properties.multiple) {
        if (checkedIndexes.includes(index)) {
          checkedIndexes.splice(index, 1);
          data = {
            checkedIndexes,
            [`_options[${index}].checked`]: false
          };
        } else {
          checkedIndexes.push(index);
          data = {
            checkedIndexes,
            [`_options[${index}].checked`]: true
          };
        }
      } else {
        if (checkedIndexes[0] === index) {
          // 单选不可取消选择
          return;
        }
        data = {
          [`_options[${index}].checked`]: true,
          checkedIndexes: [index]
        };
        if (checkedIndexes[0] !== undefined) {
          data[`_options[${checkedIndexes[0]}].checked`] = false;
        }
      }
      this.setData(data);
      this.triggerEvent('select', {
        index
      });
      this._onOptionTap && this._onOptionTap(index);
      if (!this.properties.showConfirmButton && !this.properties.multiple) {
        // 没有确认按钮且是单选的情况下，选择选项则自动确定
        this._onConfirm && this._onConfirm([index]);
        this.setData({
          show: false
        });
      }
    },
    onCancel() {
      this.triggerEvent('cancel');
      this._onCancel && this._onCancel();
      this.setData({
        show: false
      });
    },
    onConfirm() {
      if (this.data.checkedIndexes.length === 0) {
        this.toast.show({
          icon: '',
          text: this.properties.emptyTip
        });
        return;
      }
      const indexed = this.data.checkedIndexes;
      this.triggerEvent('confirm', {
        indexed
      });
      this._onConfirm && this._onConfirm(indexed);
      this.setData({
        show: false
      });
    }
  }
});
</script>

<template>
<t-popup visible="{{show}}" placement="bottom" bind:visible-change="onCancel" close-btn="{{showCloseButton}}">
  <view class="popup-content [background-color:white] [color:#222427] [border-radius:20rpx_20rpx_0_0] [overflow:hidden] [&_.header]:[height:100rpx] [&_.header]:[line-height:100rpx] [&_.header]:[text-align:center] [&_.header]:[vertical-align:middle] [&_.header]:[font-size:32rpx] [&_.header]:[font-weight:bold] [&_.header]:[position:relative] [&_.options]:[max-height:60vh] [&_.options]:[overflow-y:scroll] [&_.options]:[-webkit-overflow-scrolling:touch] [&_.options_.cell]:[height:100rpx] [&_.options_.cell]:[align-items:center] [&_.options_.cell]:[font-size:30rpx] [&_.options_.cell]:[color:#333333] [&_.button-bar]:[width:100%] [&_.button-bar]:[padding:20rpx_30rpx] [&_.button-bar]:[display:flex] [&_.button-bar]:[flex-wrap:nowrap] [&_.button-bar]:[align-items:center] [&_.button-bar]:[justify-content:space-between] [&_.button-bar_.btn]:[width:100%] [&_.button-bar_.btn]:[background:#fa4126] [&_.button-bar_.btn]:[color:#fff] [&_.button-bar_.btn]:[border-radius:48rpx]">
    <view class="header"> {{title}} </view>
    <view class="options cell--noborder">
      <t-cell
        wx:for="{{_options}}"
        wx:key="title"
        t-class="cell"
        title="{{item.title}}"
        bindclick="onOptionTap"
        data-index="{{index}}"
        border="{{false}}"
      >
        <view slot="right-icon">
          <t-icon name="check-circle-filled" size="36rpx" color="#fa4126" wx:if="{{item.checked}}" />
          <t-icon name="circle" size="36rpx" color="#C7C7C7" wx:else />
        </view>
      </t-cell>
    </view>
    <view class="button-bar [&_.btnWrapper]:[width:100%]" wx:if="{{showConfirmButton}}">
      <t-button class="btnWrapper" wx:if="{{showConfirmButton}}" t-class="btn" bindtap="onConfirm">
        {{confirmButtonText}}
      </t-button>
    </view>
  </view>
</t-popup>
<t-toast id="t-toast" />
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-popup": "tdesign-miniprogram/popup/popup",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-button": "tdesign-miniprogram/button/button"
  }
}</json>
