Component({
  options: { pureDataPattern: /^_/ },
  data: { visible: 'initial', _private: 'hidden', propertyObserverCalls: 0, dataEvents: [] },
  properties: {
    _text: { type: String, observer() { this.data.propertyObserverCalls++ } },
  },
  observers: {
    _private(value) { this.data.dataEvents.push(value) },
  },
  lifetimes: {
    attached() { this.setData({ visible: 'updated', _private: 'updated-secret' }) },
    ready() {
      getApp().globalData.pureDataContract = {
        logic: this.data._private,
        property: this.data._text,
        propertyObserverCalls: this.data.propertyObserverCalls,
        dataEvents: this.data.dataEvents,
      }
    },
  },
})
