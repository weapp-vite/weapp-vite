import { defineComponent, h, ref } from 'vue'

export default defineComponent({
  name: 'DirectTsComponent',
  props: {
    title: {
      type: String,
      default: 'TS 组件（render 函数）',
    },
    initialCount: {
      type: Number,
      default: 1,
    },
    activeLabel: {
      type: String,
      default: '已激活',
    },
    inactiveLabel: {
      type: String,
      default: '未激活',
    },
  },
  setup(props) {
    const count = ref(props.initialCount)
    const active = ref(true)

    function toggle() {
      active.value = !active.value
    }

    function increment() {
      count.value += 1
    }

    return () =>
      h(
        'view',
        {
          class: 'ts-card',
          style:
            'padding:16rpx;border-radius:14rpx;background:#fff;box-shadow:0 8rpx 20rpx rgba(0,0,0,0.04);margin-top:8rpx;display:flex;flex-direction:column;gap:10rpx;',
        },
        [
          h('text', { class: 'title', style: 'font-weight:700;color:#1a202c;' }, props.title),
          h(
            'view',
            { class: 'row', style: 'display:flex;justify-content:space-between;' },
            [
              h('text', { class: 'label', style: 'color:#4a5568;' }, '计数'),
              h('text', { class: 'value', style: 'color:#111;' }, String(count.value)),
            ],
          ),
          h(
            'view',
            { class: 'row', style: 'display:flex;justify-content:space-between;align-items:center;' },
            [
              h('text', { class: 'label', style: 'color:#4a5568;' }, '状态'),
              h(
                'view',
                {
                  class: ['pill', active.value ? 'active' : ''],
                  style: `padding:8rpx 14rpx;border-radius:999rpx;background:#edf2f7;color:#2d3748;${active.value ? 'background:#38a169;color:#fff;' : ''}`,
                },
                active.value ? props.activeLabel : props.inactiveLabel,
              ),
            ],
          ),
          h(
            'view',
            { class: 'actions', style: 'display:flex;gap:12rpx;' },
            [
              h('button', { size: 'mini', onTap: increment }, '加 1'),
              h('button', { size: 'mini', onTap: toggle }, active.value ? '切换为未激活' : '切换为激活'),
            ],
          ),
        ],
      )
  },
})
