<script lang="tsx">
import { defineComponent, ref } from 'wevu'

export default defineComponent({
  setup() {
    const visible = ref(true)
    const _toggleVisible = () => {
      visible.value = !visible.value
    }
    return { visible, _toggleVisible }
  },
  render() {
    return (
      <view>
        <text id="teleport-jsx-status">{this.visible ? 'shown' : 'hidden'}</text>
        <Teleport to="body" v-if={this.visible}>
          <view id="teleport-jsx-mapped">mapped</view>
        </Teleport>
        <Teleport to="#inner" v-if={this.visible}>
          <view id="teleport-jsx-degraded">degraded</view>
        </Teleport>
        <Teleport to="body" {...{ disabled: true }} v-if={this.visible}>
          <view id="teleport-jsx-spread">spread</view>
        </Teleport>
      </view>
    )
  },
})
</script>
