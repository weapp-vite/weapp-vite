Component({
  externalClasses: ['wr-class'],

  options: {
    multipleSlots: true,
  },

  properties: {
    overall: {
      type: Number,
      value: 1,
      observer(overall) {
        this.setData({
          currentOverall: overall,
        });
      },
    },
    layout: {
      type: Number,
      value: 1,
      observer(layout) {
        this.setData({
          currentLayout: layout,
        });
      },
    },
    sorts: {
      type: String,
      value: '',
      observer(sorts) {
        this.setData({
          currentSorts: sorts,
        });
      },
    },
    color: {
      type: String,
      value: '#FA550F',
    },
  },

  data: {
    currentLayout: 1,
    currentOverall: 1,
    currentSorts: '',
    prices: [],
  },

  methods: {
    onChangeShowAction() {
      const { currentLayout } = this.data;
      const nextLayout = currentLayout === 1 ? 0 : 1;
      this.triggerEvent('change', { ...this.properties, layout: nextLayout });
    },

    handlePriseSort() {
      const { currentSorts } = this.data;
      this.triggerEvent('change', {
        ...this.properties,
        overall: 0,
        sorts: currentSorts === 'desc' ? 'asc' : 'desc',
      });
    },

    open() {
      this.triggerEvent('showFilterPopup', {
        show: true,
      });
    },

    onOverallAction() {
      const { currentOverall } = this.data;
      const nextOverall = currentOverall === 1 ? 0 : 1;
      const nextData = {
        sorts: '',
        prices: [],
      };
      this.triggerEvent('change', {
        ...this.properties,
        ...nextData,
        overall: nextOverall,
      });
    },
  },
});
