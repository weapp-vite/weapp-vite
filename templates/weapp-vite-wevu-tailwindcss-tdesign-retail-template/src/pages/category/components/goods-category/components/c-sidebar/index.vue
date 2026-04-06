<script setup lang="ts">
defineOptions({
  relations: {
    './c-sidebar-item/index': {
      type: 'descendant',
      linked(this: any, target: any) {
        this.children ||= []
        this.topRightRadiusItemIndexs ||= []
        this.bottomRightRadiusItemIndexs ||= []
        if (typeof this.currentActive !== 'number') {
          this.currentActive = -1
        }
        this.children.push(target)
        this.setActive(this.properties.activeKey, true)
      },
      unlinked(this: any, target: any) {
        this.children ||= []
        this.topRightRadiusItemIndexs ||= []
        this.bottomRightRadiusItemIndexs ||= []
        if (typeof this.currentActive !== 'number') {
          this.currentActive = -1
        }
        this.children = this.children.filter((item: any) => item !== target)
        this.setActive(this.properties.activeKey, true)
      },
    },
  },
  externalClasses: ['custom-class'],
  properties: {
    activeKey: {
      type: Number,
      value: 0,
    },
  },
  observers: {
    activeKey(this: any, newVal: number) {
      this.setActive(newVal)
    },
  },
  created(this: any) {
    this.children ||= []
    this.topRightRadiusItemIndexs ||= []
    this.bottomRightRadiusItemIndexs ||= []
    if (typeof this.currentActive !== 'number') {
      this.currentActive = -1
    }
  },
  methods: {
    setActive(this: any, activeKey: number, isChildrenChange?: boolean) {
      this.children ||= []
      this.topRightRadiusItemIndexs ||= []
      this.bottomRightRadiusItemIndexs ||= []
      if (typeof this.currentActive !== 'number') {
        this.currentActive = -1
      }
      const {
        children,
        currentActive,
        topRightRadiusItemIndexs: preTopRightRadiusItemIndexs,
        bottomRightRadiusItemIndexs: preBottomRightRadiusItemIndexs,
      } = this
      if (!children.length) {
        return Promise.resolve()
      }
      if (activeKey === currentActive && !isChildrenChange) {
        return Promise.resolve()
      }
      this.currentActive = activeKey
      this.topRightRadiusItemIndexs = this.getTopRightRadiusItemIndexs(activeKey, children)
      this.bottomRightRadiusItemIndexs = this.getBottomRightRadiusItemIndexs(activeKey, children)
      const stack = [] // 任务列表，存放调用子组件的setActive后返回的一堆promise
      const pushChildTask = (itemIndex: number, method: string, value: boolean) => {
        const child = children[itemIndex]
        if (!child || typeof child[method] !== 'function') {
          return
        }
        stack.push(child[method](value))
      }

      // 将旧的选中项改为false
      if (currentActive !== activeKey && children[currentActive]) {
        stack.push(children[currentActive].setActive(false))
      }

      // 将新的选中项改为true
      if (children[activeKey]) {
        stack.push(children[activeKey].setActive(true))
      }
      preTopRightRadiusItemIndexs.forEach((item: number) => {
        pushChildTask(item, 'setTopRightRadius', false)
      })
      preBottomRightRadiusItemIndexs.forEach((item: number) => {
        pushChildTask(item, 'setBottomRightRadius', false)
      })
      this.topRightRadiusItemIndexs.forEach((item: number) => {
        pushChildTask(item, 'setTopRightRadius', true)
      })
      this.bottomRightRadiusItemIndexs.forEach((item: number) => {
        pushChildTask(item, 'setBottomRightRadius', true)
      })
      return Promise.all(stack)
    },
    getTopRightRadiusItemIndexs(activeKey: number, children: any[]) {
      const {
        length,
      } = children
      if (activeKey !== 0 && activeKey < length - 1) { return [0, activeKey + 1] }
      if (activeKey !== 0) { return [0] }
      if (activeKey < length - 1) { return [activeKey + 1] }
      return []
    },
    getBottomRightRadiusItemIndexs(activeKey: number) {
      if (activeKey !== 0) { return [activeKey - 1] }
      return []
    },
  },
} as any)

defineComponentJson({
  component: true,
})
</script>

<template>
  <scroll-view class="c-sidebar custom-class [width:176rpx] [height:100vh]" scroll-y>
    <slot />
  </scroll-view>
</template>
