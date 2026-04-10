// 本文件由 components.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_FORM_CONTROLS_SELECTION = [
  {
    "name": "picker",
    "description": "从底部弹起的滚动选择器，现支持五种选择器，通过mode来区分，分别是普通选择器，多列选择器，时间选择器，日期选择器，省市区选择器，默认是普通选择器。",
    "attributes": [
      {
        "name": "mode",
        "description": "Type: string\n选择器的类型\nDefault: selector"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/picker.html"
      }
    ]
  },
  {
    "name": "picker-view",
    "description": "嵌入页面的滚动选择器",
    "attributes": [
      {
        "name": "bindchange",
        "description": "Type: function => any\n当滚动选择，value 改变时触发 change 事件，event.detail = {value: value}；value为数组，表示 picker-view 内的 picker-view-column 当前选择的是第几项（下标从 0 开始）"
      },
      {
        "name": "indicator-class",
        "description": "Type: string\n设置选择器中间选中框的类名\nSince: 1.1.0"
      },
      {
        "name": "indicator-style",
        "description": "Type: string\n设置选择器中间选中框的样式"
      },
      {
        "name": "mask-class",
        "description": "Type: string\n设置蒙层的类名\nSince: 1.5.0"
      },
      {
        "name": "mask-style",
        "description": "Type: string\n设置蒙层的样式\nSince: 1.5.0"
      },
      {
        "name": "value",
        "description": "Type: number[]\n数组中的数字依次表示 picker-view 内的 picker-view-column 选择的第几项（下标从 0 开始），数字大于 picker-view-column 可选项长度时，选择最后一项。"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html"
      }
    ]
  },
  {
    "name": "picker-view-column",
    "description": "仅可放置于`<picker-view />`中，其孩子节点的高度会自动设置成与picker-view的选中框的高度一致",
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html"
      }
    ]
  },
  {
    "name": "progress",
    "description": "进度条。",
    "attributes": [
      {
        "name": "active",
        "description": "Type: boolean\n进度条从左往右的动画\nDefault: false"
      },
      {
        "name": "active-color",
        "description": "Type: string\n已选择的进度条的颜色"
      },
      {
        "name": "active-mode",
        "description": "Type: string\nbackwards: 动画从头播；forwards：动画从上次结束点接着播\nDefault: backwards\nSince: 1.7.0"
      },
      {
        "name": "background-color",
        "description": "Type: string\n未选择的进度条的颜色"
      },
      {
        "name": "color",
        "description": "Type: string\n进度条颜色 （请使用 active-color）\nDefault: #09BB07"
      },
      {
        "name": "percent",
        "description": "Type: number\n百分比0~100\nDefault: 无"
      },
      {
        "name": "show-info",
        "description": "Type: boolean\n在进度条右侧显示百分比\nDefault: false"
      },
      {
        "name": "stroke-width",
        "description": "Type: number\n进度条线的宽度，单位px\nDefault: 6"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/progress.html"
      }
    ]
  },
  {
    "name": "radio",
    "description": "单选项目",
    "attributes": [
      {
        "name": "checked",
        "description": "Type: boolean\n当前是否选中\nDefault: false"
      },
      {
        "name": "color",
        "description": "Type: string\nradio的颜色，同css的color"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false"
      },
      {
        "name": "value",
        "description": "Type: string\n`<radio/>` 标识。当该`<radio/>` 选中时，`<radio-group/>` 的 change 事件会携带`<radio/>`的value"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/radio.html"
      }
    ]
  },
  {
    "name": "radio-group",
    "description": "单项选择器，内部由多个`<radio/>`组成。",
    "attributes": [
      {
        "name": "bindchange",
        "description": "Type: function => any\n`<radio-group/>` 中的选中项发生变化时触发 change 事件，event.detail = {value: 选中项radio的value}"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/radio.html"
      }
    ]
  },
  {
    "name": "slider",
    "description": "滑动选择器。",
    "attributes": [
      {
        "name": "active-color",
        "description": "Type: string\n已选择的颜色\nDefault: #1aad19"
      },
      {
        "name": "background-color",
        "description": "Type: string\n背景条的颜色\nDefault: #e9e9e9"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any\n完成一次拖动后触发的事件，event.detail = {value: value}"
      },
      {
        "name": "bindchanging",
        "description": "Type: function => any\n拖动过程中触发的事件，event.detail = {value: value}\nSince: 1.7.0"
      },
      {
        "name": "block-color",
        "description": "Type: string\n滑块的颜色\nDefault: #ffffff\nSince: 1.9.0"
      },
      {
        "name": "block-size",
        "description": "Type: number\n滑块的大小，取值范围为 12 - 28\nDefault: 28\nSince: 1.9.0"
      },
      {
        "name": "color",
        "description": "Type: string\n背景条的颜色（请使用 background-color）\nDefault: #e9e9e9"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false"
      },
      {
        "name": "max",
        "description": "Type: number\n最大值\nDefault: 100"
      },
      {
        "name": "min",
        "description": "Type: number\n最小值\nDefault: 0"
      },
      {
        "name": "selected-color",
        "description": "Type: string\n已选择的颜色（请使用 active-color）\nDefault: #1aad19"
      },
      {
        "name": "show-value",
        "description": "Type: boolean\n是否显示当前 value\nDefault: false"
      },
      {
        "name": "step",
        "description": "Type: number\n步长，取值必须大于 0，并且可被(max - min)整除\nDefault: 1"
      },
      {
        "name": "value",
        "description": "Type: number\n当前取值\nDefault: 0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/slider.html"
      }
    ]
  },
  {
    "name": "switch",
    "description": "开关选择器。",
    "attributes": [
      {
        "name": "bindchange",
        "description": "Type: function => any\nchecked 改变时触发 change 事件，event.detail={ value:checked}"
      },
      {
        "name": "checked",
        "description": "Type: boolean\n是否选中\nDefault: false"
      },
      {
        "name": "color",
        "description": "Type: string\nswitch 的颜色，同 css 的 color"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false"
      },
      {
        "name": "type",
        "description": "Type: string\n样式，有效值：switch, checkbox\nDefault: switch"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/switch.html"
      }
    ]
  },
  {
    "name": "textarea",
    "description": "多行输入框。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。",
    "attributes": [
      {
        "name": "adjust-position",
        "description": "Type: boolean\n键盘弹起时，是否自动上推页面\nDefault: true\nSince: 1.9.90"
      },
      {
        "name": "auto-focus",
        "description": "Type: boolean\n自动聚焦，拉起键盘。\nDefault: false"
      },
      {
        "name": "auto-height",
        "description": "Type: boolean\n是否自动增高，设置auto-height时，style.height不生效\nDefault: false"
      },
      {
        "name": "bindblur",
        "description": "Type: function => any\n输入框失去焦点时触发，event.detail = {value, cursor}"
      },
      {
        "name": "bindconfirm",
        "description": "Type: function => any\n点击完成时， 触发 confirm 事件，event.detail = {value: value}"
      },
      {
        "name": "bindfocus",
        "description": "Type: function => any\n输入框聚焦时触发，event.detail = { value, height }，height 为键盘高度，在基础库 1.9.90 起支持"
      },
      {
        "name": "bindinput",
        "description": "Type: function => any\n当键盘输入时，触发 input 事件，event.detail = {value, cursor}，**bindinput 处理函数的返回值并不会反映到 textarea 上**"
      },
      {
        "name": "bindkeyboardheightchange",
        "description": "Type: function => any\n键盘高度发生变化的时候触发此事件，event.detail = {height: height, duration: duration}\nSince: 2.7.0"
      },
      {
        "name": "bindlinechange",
        "description": "Type: function => any\n输入框行数变化时调用，event.detail = {height: 0, heightRpx: 0, lineCount: 0}"
      },
      {
        "name": "confirm-hold",
        "description": "Type: boolean\n点击键盘右下角按钮时是否保持键盘不收起\nDefault: false\nSince: 2.16.0"
      },
      {
        "name": "confirm-type",
        "description": "Type: string\n设置键盘右下角按钮的文字\nDefault: return\nSince: 2.13.0"
      },
      {
        "name": "cursor",
        "description": "Type: number\n指定focus时的光标位置\nSince: 1.5.0"
      },
      {
        "name": "cursor-spacing",
        "description": "Type: number\n指定光标与键盘的距离，单位 px 。取 textarea 距离底部的距离和 cursor-spacing 指定的距离的最小值作为光标与键盘的距离\nDefault: 0"
      },
      {
        "name": "disable-default-padding",
        "description": "Type: boolean\n是否去掉 iOS 下的默认内边距\nDefault: false\nSince: 2.10.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false"
      },
      {
        "name": "fixed",
        "description": "Type: boolean\n如果 textarea 是在一个 `position:fixed` 的区域，需要显示指定属性 fixed 为 true\nDefault: false"
      },
      {
        "name": "focus",
        "description": "Type: boolean\n获取焦点\nDefault: false"
      },
      {
        "name": "hold-keyboard",
        "description": "Type: boolean\nfocus时，点击页面的时候不收起键盘\nDefault: false\nSince: 2.8.2"
      },
      {
        "name": "maxlength",
        "description": "Type: number\n最大输入长度，设置为 -1 的时候不限制最大长度\nDefault: 140"
      },
      {
        "name": "placeholder",
        "description": "Type: string\n输入框为空时占位符"
      },
      {
        "name": "placeholder-class",
        "description": "Type: string\n指定 placeholder 的样式类\nDefault: textarea-placeholder"
      },
      {
        "name": "placeholder-style",
        "description": "Type: string\n指定 placeholder 的样式"
      },
      {
        "name": "selection-end",
        "description": "Type: number\n光标结束位置，自动聚集时有效，需与selection-start搭配使用\nDefault: -1\nSince: 1.9.0"
      },
      {
        "name": "selection-start",
        "description": "Type: number\n光标起始位置，自动聚集时有效，需与selection-end搭配使用\nDefault: -1\nSince: 1.9.0"
      },
      {
        "name": "show-confirm-bar",
        "description": "Type: boolean\n是否显示键盘上方带有”完成“按钮那一栏\nDefault: true\nSince: 1.6.0"
      },
      {
        "name": "value",
        "description": "Type: string\n输入框的内容"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/textarea.html"
      }
    ]
  }
]
