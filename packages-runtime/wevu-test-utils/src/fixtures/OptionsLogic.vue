<script lang="ts">
import { inject, onMounted, onUnmounted } from 'wevu'

export default {
  props: {
    label: { type: String, default: 'default-label' },
  },
  data: () => ({ count: 1 }),
  computed: {
    upper() {
      return this.label.toUpperCase()
    },
  },
  methods: {
    increment() {
      this.count += 1
    },
  },
  watch: {
    label() {
      this.count += 1
    },
  },
  inject: {
    injected: { from: 'token' },
  },
  setup(_props, { emit }) {
    inject('token')
    onMounted(() => emit('mounted'))
    onUnmounted(() => emit('unmounted'))
  },
}
</script>
