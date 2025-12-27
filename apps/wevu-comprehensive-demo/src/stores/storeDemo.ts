import { computed, createStore, defineStore, ref } from 'wevu'

// 全局 store manager（可选）：挂载插件用于演示 $onAction/$subscribe 扩展
export const storeManager = createStore()
storeManager.use(({ store }) => {
  if (store.$id !== 'plugin-demo') {
    return
  }

  const pluginLog = ref<string[]>(['插件已挂载'])
  const lastMutation = ref('尚未触发')
  const lastAction = ref('尚未调用')

  ;(store as any).$pluginLog = pluginLog
  ;(store as any).$lastMutation = lastMutation
  ;(store as any).$lastAction = lastAction

  store.$subscribe((mutation) => {
    pluginLog.value.unshift(`mutation: ${mutation.type}`)
    lastMutation.value = mutation.type
  })

  store.$onAction(({ name, after, onError }) => {
    pluginLog.value.unshift(`action: ${name}`)
    after(() => {
      lastAction.value = name
    })
    onError((error: Error) => {
      pluginLog.value.unshift(`error: ${error.message}`)
    })
  })
})

// Setup Store 示例
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const name = ref('Counter')

  const doubleCount = computed(() => count.value * 2)
  const displayName = computed(() => `${name.value}: ${count.value}`)

  function increment() {
    count.value++
  }

  function decrement() {
    count.value--
  }

  function reset() {
    count.value = 0
  }

  function setValue(value: number) {
    count.value = value
  }

  return {
    count,
    name,
    doubleCount,
    displayName,
    increment,
    decrement,
    reset,
    setValue,
  }
})

// Options Store 示例
export const useUserStore = defineStore('user', {
  state: () => ({
    userName: '张三',
    age: 25,
  }),

  getters: {
    label(state): string {
      return `${state.userName}: ${this.age}岁`
    },

    canVote(): boolean {
      return this.age >= 18
    },
  },

  actions: {
    grow() {
      this.age++
    },

    setName(name: string) {
      this.userName = name
    },
  },
})

export type TodoFilter = 'all' | 'todo' | 'done'

// 任务列表：演示 $patch（对象/函数）、$state 替换、$subscribe
export const useTodoStore = defineStore('todo', {
  state: () => ({
    items: [
      { id: 1, title: '学习 wevu', done: false },
      { id: 2, title: '演示 $patch 记录', done: true },
    ],
    filter: 'all' as TodoFilter,
  }),
  getters: {
    visibleItems(state) {
      if (state.filter === 'done') {
        return state.items.filter(item => item.done)
      }
      if (state.filter === 'todo') {
        return state.items.filter(item => !item.done)
      }
      return state.items
    },
    summary(state): string {
      const finished = state.items.filter(item => item.done).length
      return `${finished}/${state.items.length} 完成`
    },
  },
  actions: {
    toggle(id: number) {
      this.$patch((state) => {
        const target = state.items.find(item => item.id === id)
        if (target) {
          target.done = !target.done
        }
      })
    },
    addQuick(title: string) {
      this.$patch((state) => {
        state.items.unshift({
          id: Date.now(),
          title,
          done: false,
        })
      })
    },
    completeAll() {
      this.$patch((state) => {
        state.items.forEach((item) => {
          item.done = true
        })
      })
    },
    setFilter(filter: TodoFilter) {
      this.$patch({ filter })
    },
    loadPreset() {
      this.$state = {
        items: [
          { id: 101, title: '来自 $state 的预置数据', done: false },
          { id: 102, title: '通过 $state 替换整个状态', done: false },
        ],
        filter: 'all' as TodoFilter,
      }
    },
  },
})

// 插件示例：结合 createStore().use() + $onAction/$subscribe
export const usePluginDemoStore = defineStore('plugin-demo', {
  state: () => ({
    status: 'idle' as 'idle' | 'pending' | 'ok' | 'error',
    requestCount: 0,
  }),
  getters: {
    statusText(state): string {
      const map: Record<typeof state.status, string> = {
        idle: '空闲',
        pending: '执行中…',
        ok: '已完成',
        error: '出错',
      }
      return map[state.status]
    },
  },
  actions: {
    async runAsyncTask() {
      this.$patch({ status: 'pending' })
      await new Promise(resolve => setTimeout(resolve, 120))
      this.$patch((state) => {
        state.status = 'ok'
        state.requestCount += 1
      })
      return this.requestCount
    },
    failOnce() {
      this.$patch({ status: 'error' })
      throw new Error('模拟的业务错误')
    },
    clearStatus() {
      this.$reset()
      const pluginLog = (this as any).$pluginLog as undefined | { value: string[] }
      if (pluginLog) {
        pluginLog.value.unshift('通过 $reset 回到初始状态')
      }
    },
  },
})
