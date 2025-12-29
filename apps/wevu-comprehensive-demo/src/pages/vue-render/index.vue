<script lang="ts">
import { h, resolveComponent } from 'vue'

export default {
  data() {
    return {
      count: 0,
      list: ['alpha', 'beta', 'gamma'],
    }
  },
  methods: {
    increment() {
      this.count += 1
    },
    shuffle() {
      this.list = [...this.list].reverse()
    },
  },
  render() {
    const View = resolveComponent('view') as any
    const Text = resolveComponent('text') as any
    const Button = resolveComponent('button') as any

    return h(View, { class: 'container' }, [
      h(View, { class: 'page-title' }, 'Render 函数'),
      h(View, { class: 'section' }, [
        h(View, { class: 'section-title' }, 'render() 覆盖'),
        h(View, { class: 'card' }, [
          h(Text, null, `count: ${this.count}`),
          h(View, { class: 'actions' }, [
            h(Button, { class: 'btn btn-primary', onClick: this.increment }, '+1'),
            h(Button, { class: 'btn btn-warning', onClick: this.shuffle }, 'reverse'),
          ]),
          ...this.list.map(item => h(View, { key: item, class: 'pill' }, [h(Text, null, item)])),
        ]),
      ]),
    ])
  },
}
</script>

<style>
/* stylelint-disable order/properties-order */
.card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.actions {
  display: flex;
  gap: 12rpx;
}

.pill {
  padding: 12rpx;
  border-radius: 12rpx;
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "Render 函数"
}
</config>
