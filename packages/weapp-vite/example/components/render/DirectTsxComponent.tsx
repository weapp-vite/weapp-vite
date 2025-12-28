import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'DirectTsxComponent',
  props: {
    title: {
      type: String,
      default: 'TSX 组件（JSX 写法）',
    },
    initialPercent: {
      type: Number,
      default: 40,
    },
    step: {
      type: Number,
      default: 20,
    },
  },
  setup(props) {
    const percent = ref(props.initialPercent)

    function bump() {
      percent.value = (percent.value + props.step) % 120
    }

    return () => (
      <view
        class="tsx-card"
        style="padding:16rpx;border-radius:14rpx;background:#f8fafc;box-shadow:0 8rpx 20rpx rgba(0,0,0,0.04);margin-top:8rpx;display:flex;flex-direction:column;gap:10rpx;"
      >
        <text class="title" style="font-weight:700;color:#1a202c;">
          {props.title}
        </text>
        <view class="row" style="display:flex;justify-content:space-between;align-items:center;">
          <text class="label" style="color:#4a5568;">
            进度
          </text>
          <text class="value" style="color:#111;">
            {`${percent.value}%`}
          </text>
        </view>
        <view
          class="bar"
          style="height:16rpx;border-radius:12rpx;background:#e2e8f0;overflow:hidden;position:relative;"
        >
          <view
            class="bar-inner"
            style={`position:absolute;left:0;top:0;bottom:0;width:${percent.value}%;background:#3182ce;transition:width 150ms ease;`}
          />
        </view>
        <view class="actions" style="display:flex;gap:12rpx;">
          <button size="mini" type="primary" onTap={bump}>
            增加
            {` ${props.step}%`}
          </button>
        </view>
      </view>
    )
  },
})
