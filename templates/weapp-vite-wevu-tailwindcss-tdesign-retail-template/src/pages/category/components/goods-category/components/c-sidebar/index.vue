<script lang="ts">
Component({
  relations: {
    './c-sidebar-item/index': {
      type: 'descendant',
      linked(target) {
        this.children.push(target);
        this.setActive(this.properties.activeKey, true);
      },
      unlinked(target) {
        this.children = this.children.filter((item) => item !== target);
        this.setActive(this.properties.activeKey, true);
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
    activeKey(newVal) {
      this.setActive(newVal);
    },
  },

  created() {
    this.children = [];
    this.currentActive = -1;
    this.topRightRadiusItemIndexs = [];
    this.bottomRightRadiusItemIndexs = [];
  },

  methods: {
    setActive(activeKey, isChildrenChange) {
      const {
        children,
        currentActive,
        topRightRadiusItemIndexs: preTopRightRadiusItemIndexs,
        bottomRightRadiusItemIndexs: preBottomRightRadiusItemIndexs,
      } = this;

      if (!children.length) {
        return Promise.resolve();
      }

      if (activeKey === currentActive && !isChildrenChange) {
        return Promise.resolve();
      }

      this.currentActive = activeKey;
      this.topRightRadiusItemIndexs = this.getTopRightRadiusItemIndexs(activeKey, children);
      this.bottomRightRadiusItemIndexs = this.getBottomRightRadiusItemIndexs(activeKey, children);

      const stack = []; // 任务列表，存放调用子组件的setActive后返回的一堆promise
      const pushChildTask = (itemIndex, method, value) => {
        const child = children[itemIndex];
        if (!child || typeof child[method] !== 'function') {
          return;
        }
        stack.push(child[method](value));
      };

      // 将旧的选中项改为false
      if (currentActive !== activeKey && children[currentActive]) {
        stack.push(children[currentActive].setActive(false));
      }

      // 将新的选中项改为true
      if (children[activeKey]) {
        stack.push(children[activeKey].setActive(true));
      }

      preTopRightRadiusItemIndexs.forEach((item) => {
        pushChildTask(item, 'setTopRightRadius', false);
      });

      preBottomRightRadiusItemIndexs.forEach((item) => {
        pushChildTask(item, 'setBottomRightRadius', false);
      });

      this.topRightRadiusItemIndexs.forEach((item) => {
        pushChildTask(item, 'setTopRightRadius', true);
      });

      this.bottomRightRadiusItemIndexs.forEach((item) => {
        pushChildTask(item, 'setBottomRightRadius', true);
      });

      return Promise.all(stack);
    },
    getTopRightRadiusItemIndexs(activeKey, children) {
      const { length } = children;
      if (activeKey !== 0 && activeKey < length - 1) return [0, activeKey + 1];
      if (activeKey !== 0) return [0];
      if (activeKey < length - 1) return [activeKey + 1];
      return [];
    },
    getBottomRightRadiusItemIndexs(activeKey) {
      if (activeKey !== 0) return [activeKey - 1];
      return [];
    },
  },
});
</script>

<template>
<scroll-view class="c-sidebar custom-class [width:176rpx] [height:100vh]" scroll-y>
  <slot />
</scroll-view>
</template>

<json>
{
  "component": true
}
</json>
