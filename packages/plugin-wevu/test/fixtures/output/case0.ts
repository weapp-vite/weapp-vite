import { createWevuComponent } from '@weapp-vite/plugin-wevu/runtime'

const __wevuOptions = {
  type: 'page',
  data() {
    return {
      message: 'Hello Wevu',
      array: ['A', 'B', 'C'],
      view: 'WEBVIEW',
      staffA: { firstName: 'San', lastName: 'Zhang' },
      staffB: { firstName: 'Si', lastName: 'Li' },
      staffC: { firstName: 'Wu', lastName: 'Wang' },
    }
  },
  computed: {
    upperMessage() {
      return this.message.toUpperCase()
    },
  },
  methods: {
    setView(view: string) {
      this.view = view
    },
  },
  watch: {
    view(newValue: string, oldValue: string) {
      console.log('view changed from', oldValue, 'to', newValue)
    },
  },
};

createWevuComponent(__wevuOptions);
