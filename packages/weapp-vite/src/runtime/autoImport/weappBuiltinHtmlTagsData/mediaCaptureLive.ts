// 本文件由 components.weapp.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_MEDIA_CAPTURE_LIVE = [
  {
    "name": "camera",
    "description": "系统相机。扫码二维码功能，需升级微信客户端至6.7.3。需要[用户授权](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html) `scope.camera`。\n[2.10.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起 initdone 事件返回 maxZoom，最大变焦范围，相关接口 [CameraContext.setZoom](https://developers.weixin.qq.com/miniprogram/dev/api/media/camera/CameraContext.setZoom.html)。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any"
      },
      {
        "name": "bindinitdone",
        "description": "Type: function => any"
      },
      {
        "name": "bindscancode",
        "description": "Type: function => any"
      },
      {
        "name": "bindstop",
        "description": "Type: function => any"
      },
      {
        "name": "device-position",
        "description": "Type: string\nDefault: back",
        "values": [
          {
            "name": "front",
            "description": "前置"
          },
          {
            "name": "back",
            "description": "后置"
          }
        ]
      },
      {
        "name": "flash",
        "description": "Type: string\nDefault: auto",
        "values": [
          {
            "name": "auto",
            "description": "自动"
          },
          {
            "name": "on",
            "description": "打开"
          },
          {
            "name": "off",
            "description": "关闭"
          },
          {
            "name": "torch",
            "description": "常亮"
          }
        ]
      },
      {
        "name": "frame-size",
        "description": "Type: string\nDefault: medium",
        "values": [
          {
            "name": "small",
            "description": "小尺寸帧数据"
          },
          {
            "name": "medium",
            "description": "中尺寸帧数据"
          },
          {
            "name": "large",
            "description": "大尺寸帧数据"
          }
        ]
      },
      {
        "name": "mode",
        "description": "Type: string\nDefault: normal",
        "values": [
          {
            "name": "normal",
            "description": "相机模式"
          },
          {
            "name": "scanCode",
            "description": "扫码模式"
          }
        ]
      },
      {
        "name": "resolution",
        "description": "Type: string\nDefault: medium",
        "values": [
          {
            "name": "low",
            "description": "低"
          },
          {
            "name": "medium",
            "description": "中"
          },
          {
            "name": "high",
            "description": "高"
          }
        ]
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/camera.html"
      }
    ]
  },
  {
    "name": "canvas",
    "description": "画布。2.9.0 起支持一套新 Canvas 2D 接口（需指定 type 属性），同时支持[同层渲染](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html#%E5%8E%9F%E7%94%9F%E7%BB%84%E4%BB%B6%E5%90%8C%E5%B1%82%E6%B8%B2%E6%9F%93)，原有接口不再维护。旧版本可参考 [旧版画布迁移指南](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/canvas-legacy-migration.html) 进行迁移。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\n当发生错误时触发 error 事件，detail = {errMsg}\nSince: 1.0.0"
      },
      {
        "name": "bindlongtap",
        "description": "Type: function => any\n手指长按 500ms 之后触发，触发了长按事件后进行移动不会触发屏幕的滚动\nSince: 1.0.0"
      },
      {
        "name": "bindtouchcancel",
        "description": "Type: function => any\n手指触摸动作被打断，如来电提醒，弹窗\nSince: 1.0.0"
      },
      {
        "name": "bindtouchend",
        "description": "Type: function => any\n手指触摸动作结束\nSince: 1.0.0"
      },
      {
        "name": "bindtouchmove",
        "description": "Type: function => any\n手指触摸后移动\nSince: 1.0.0"
      },
      {
        "name": "bindtouchstart",
        "description": "Type: function => any\n手指触摸动作开始\nSince: 1.0.0"
      },
      {
        "name": "canvas-id",
        "description": "Type: string\ncanvas 组件的唯一标识符，若指定了 type 则无需再指定该属性\nSince: 1.0.0"
      },
      {
        "name": "disable-scroll",
        "description": "Type: boolean\n当在 canvas 中移动时且有绑定手势事件时，禁止屏幕滚动以及下拉刷新\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "type",
        "description": "Type: string\n指定 canvas 类型，支持 2d (2.9.0) 和 webgl (2.7.0)\nSince: 2.7.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html"
      }
    ]
  },
  {
    "name": "live-player",
    "description": "实时音视频播放（v2.9.1 起支持[同层渲染](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html#%E5%8E%9F%E7%94%9F%E7%BB%84%E4%BB%B6%E5%90%8C%E5%B1%82%E6%B8%B2%E6%9F%93)）。",
    "attributes": [
      {
        "name": "auto-pause-if-navigate",
        "description": "Type: boolean\nDefault: true\nSince: 2.5.0"
      },
      {
        "name": "auto-pause-if-open-native",
        "description": "Type: boolean\nDefault: true\nSince: 2.5.0"
      },
      {
        "name": "autoplay",
        "description": "Type: boolean\nDefault: false\nSince: 1.7.0"
      },
      {
        "name": "background-mute",
        "description": "Type: boolean\nDefault: false\nSince: 1.7.0"
      },
      {
        "name": "bindaudiovolumenotify",
        "description": "Type: function => any\nSince: 2.10.0"
      },
      {
        "name": "bindcastinginterrupt",
        "description": "Type: function => any\nSince: 2.32.0"
      },
      {
        "name": "bindcastingstatechange",
        "description": "Type: function => any\nSince: 2.32.0"
      },
      {
        "name": "bindcastinguserselect",
        "description": "Type: function => any\nSince: 2.32.0"
      },
      {
        "name": "bindenterpictureinpicture",
        "description": "Type: function => any\nSince: 2.11.0"
      },
      {
        "name": "bindfullscreenchange",
        "description": "Type: function => any\nSince: 1.7.0"
      },
      {
        "name": "bindleavepictureinpicture",
        "description": "Type: function => any\nSince: 2.11.0"
      },
      {
        "name": "bindnetstatus",
        "description": "Type: function => any\nSince: 1.9.0"
      },
      {
        "name": "bindstatechange",
        "description": "Type: function => any\nSince: 1.7.0"
      },
      {
        "name": "enable-auto-rotation",
        "description": "Type: boolean\nDefault: false\nSince: 2.11.0"
      },
      {
        "name": "enable-casting",
        "description": "Type: boolean\nDefault: false\nSince: 2.32.0"
      },
      {
        "name": "max-cache",
        "description": "Type: number\nDefault: 3\nSince: 1.7.0"
      },
      {
        "name": "min-cache",
        "description": "Type: number\nDefault: 1\nSince: 1.7.0"
      },
      {
        "name": "mode",
        "description": "Type: string\nDefault: live\nSince: 1.7.0",
        "values": [
          {
            "name": "live",
            "description": "直播"
          },
          {
            "name": "RTC",
            "description": "实时通话，该模式时延更低"
          }
        ]
      },
      {
        "name": "muted",
        "description": "Type: boolean\nDefault: false\nSince: 1.7.0"
      },
      {
        "name": "object-fit",
        "description": "Type: string\nDefault: contain\nSince: 1.7.0",
        "values": [
          {
            "name": "contain",
            "description": "图像长边填满屏幕，短边区域会被填充⿊⾊"
          },
          {
            "name": "fillCrop",
            "description": "图像铺满屏幕，超出显示区域的部分将被截掉"
          }
        ]
      },
      {
        "name": "orientation",
        "description": "Type: string\nDefault: vertical\nSince: 1.7.0",
        "values": [
          {
            "name": "vertical",
            "description": "竖直"
          },
          {
            "name": "horizontal",
            "description": "水平"
          }
        ]
      },
      {
        "name": "picture-in-picture-init-position",
        "description": "Type: string\nSince: 3.3.0"
      },
      {
        "name": "picture-in-picture-mode",
        "description": "Type: string | any[]\nSince: 2.10.3",
        "values": [
          {
            "name": "[]",
            "description": "取消小窗"
          },
          {
            "name": "push",
            "description": "路由 push 时触发小窗"
          },
          {
            "name": "pop",
            "description": "路由 pop 时触发小窗"
          }
        ]
      },
      {
        "name": "referrer-policy",
        "description": "Type: string\nDefault: no-referrer\nSince: 2.13.0",
        "values": [
          {
            "name": "origin",
            "description": "发送完整的referrer"
          },
          {
            "name": "no-referrer",
            "description": "不发送"
          }
        ]
      },
      {
        "name": "sound-mode",
        "description": "Type: string\nDefault: speaker\nSince: 1.9.90",
        "values": [
          {
            "name": "speaker",
            "description": "扬声器"
          },
          {
            "name": "ear",
            "description": "听筒"
          }
        ]
      },
      {
        "name": "src",
        "description": "Type: string\nSince: 1.7.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html"
      }
    ]
  },
  {
    "name": "live-pusher",
    "description": "实时音视频录制（v2.9.1 起支持[同层渲染](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html#%E5%8E%9F%E7%94%9F%E7%BB%84%E4%BB%B6%E5%90%8C%E5%B1%82%E6%B8%B2%E6%9F%93)）。需要[用户授权](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html) `scope.camera`、`scope.record`。",
    "attributes": [
      {
        "name": "aspect",
        "description": "Type: string\nDefault: 9:16"
      },
      {
        "name": "audio-quality",
        "description": "Type: string\nDefault: high"
      },
      {
        "name": "audio-reverb-type",
        "description": "Type: number\nDefault: 0",
        "values": [
          {
            "name": "0",
            "description": "关闭"
          },
          {
            "name": "1",
            "description": "KTV"
          },
          {
            "name": "2",
            "description": "小房间"
          },
          {
            "name": "3",
            "description": "大会堂"
          },
          {
            "name": "4",
            "description": "低沉"
          },
          {
            "name": "5",
            "description": "洪亮"
          },
          {
            "name": "6",
            "description": "金属声"
          },
          {
            "name": "7",
            "description": "磁性"
          }
        ]
      },
      {
        "name": "audio-volume-type",
        "description": "Type: string\nDefault: auto",
        "values": [
          {
            "name": "auto",
            "description": "自动"
          },
          {
            "name": "media",
            "description": "媒体音量"
          },
          {
            "name": "voicecall",
            "description": "通话音量"
          }
        ]
      },
      {
        "name": "auto-focus",
        "description": "Type: boolean\nDefault: true"
      },
      {
        "name": "autopush",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "background-mute",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "beauty",
        "description": "Type: number\nDefault: 0"
      },
      {
        "name": "beauty-style",
        "description": "Type: string\nDefault: smooth",
        "values": [
          {
            "name": "smooth",
            "description": "光滑美颜"
          },
          {
            "name": "nature",
            "description": "自然美颜"
          }
        ]
      },
      {
        "name": "bindaudiovolumenotify",
        "description": "Type: function => any"
      },
      {
        "name": "bindbgmcomplete",
        "description": "Type: function => any"
      },
      {
        "name": "bindbgmprogress",
        "description": "Type: function => any"
      },
      {
        "name": "bindbgmstart",
        "description": "Type: function => any"
      },
      {
        "name": "bindenterpictureinpicture",
        "description": "Type: function => any"
      },
      {
        "name": "binderror",
        "description": "Type: function => any"
      },
      {
        "name": "bindleavepictureinpicture",
        "description": "Type: function => any"
      },
      {
        "name": "bindnetstatus",
        "description": "Type: function => any"
      },
      {
        "name": "bindstatechange",
        "description": "Type: function => any"
      },
      {
        "name": "custom-effect",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "device-position",
        "description": "Type: string\nDefault: front"
      },
      {
        "name": "enable-agc",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "enable-ans",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "enable-camera",
        "description": "Type: boolean\nDefault: true"
      },
      {
        "name": "enable-mic",
        "description": "Type: boolean\nDefault: true"
      },
      {
        "name": "enableVideoCustomRender",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "eye-bigness",
        "description": "Type: number\nDefault: 0"
      },
      {
        "name": "face-thinness",
        "description": "Type: number\nDefault: 0"
      },
      {
        "name": "filter",
        "description": "Type: string\nDefault: standard",
        "values": [
          {
            "name": "standard",
            "description": "标准"
          },
          {
            "name": "pink",
            "description": "粉嫩"
          },
          {
            "name": "nostalgia",
            "description": "怀旧"
          },
          {
            "name": "blues",
            "description": "蓝调"
          },
          {
            "name": "romantic",
            "description": "浪漫"
          },
          {
            "name": "cool",
            "description": "清凉"
          },
          {
            "name": "fresher",
            "description": "清新"
          },
          {
            "name": "solor",
            "description": "日系"
          },
          {
            "name": "aestheticism",
            "description": "唯美"
          },
          {
            "name": "whitening",
            "description": "美白"
          },
          {
            "name": "cerisered",
            "description": "樱红"
          }
        ]
      },
      {
        "name": "fps",
        "description": "Type: number\nDefault: 15"
      },
      {
        "name": "local-mirror",
        "description": "Type: string\nDefault: auto",
        "values": [
          {
            "name": "auto",
            "description": "前置摄像头镜像，后置摄像头不镜像"
          },
          {
            "name": "enable",
            "description": "前后置摄像头均镜像"
          },
          {
            "name": "disable",
            "description": "前后置摄像头均不镜像"
          }
        ]
      },
      {
        "name": "max-bitrate",
        "description": "Type: number\nDefault: 1000"
      },
      {
        "name": "min-bitrate",
        "description": "Type: number\nDefault: 200"
      },
      {
        "name": "mirror",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "mode",
        "description": "Type: string\nDefault: RTC",
        "values": [
          {
            "name": "QVGA",
            "description": "Quarter VGA"
          },
          {
            "name": "HVGA",
            "description": "Half-size VGA"
          },
          {
            "name": "SD",
            "description": "标清"
          },
          {
            "name": "HD",
            "description": "高清"
          },
          {
            "name": "FHD",
            "description": "超清"
          },
          {
            "name": "RTC",
            "description": "实时通话"
          }
        ]
      },
      {
        "name": "muted",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "orientation",
        "description": "Type: string\nDefault: vertical",
        "values": [
          {
            "name": "vertical",
            "description": "竖直"
          },
          {
            "name": "horizontal",
            "description": "水平"
          }
        ]
      },
      {
        "name": "picture-in-picture-mode",
        "description": "Type: string | any[]",
        "values": [
          {
            "name": "[]",
            "description": "取消小窗"
          },
          {
            "name": "push",
            "description": "路由 push 时触发小窗"
          },
          {
            "name": "pop",
            "description": "路由 pop 时触发小窗"
          }
        ]
      },
      {
        "name": "remote-mirror",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "skin-smoothness",
        "description": "Type: number\nDefault: 0"
      },
      {
        "name": "skin-whiteness",
        "description": "Type: number\nDefault: 0"
      },
      {
        "name": "url",
        "description": "Type: string"
      },
      {
        "name": "video-height",
        "description": "Type: number\nDefault: 640"
      },
      {
        "name": "video-width",
        "description": "Type: number\nDefault: 360"
      },
      {
        "name": "voice-changer-type",
        "description": "Type: number\nDefault: 0"
      },
      {
        "name": "waiting-image",
        "description": "Type: string"
      },
      {
        "name": "waiting-image-hash",
        "description": "Type: string"
      },
      {
        "name": "whiteness",
        "description": "Type: number\nDefault: 0"
      },
      {
        "name": "zoom",
        "description": "Type: boolean\nDefault: false"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html"
      }
    ]
  },
  {
    "name": "voip-room",
    "description": "多人音视频对话。需[用户授权](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html) `scope.camera`、`scope.record`。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\nSince: 2.11.0"
      },
      {
        "name": "device-position",
        "description": "Type: string\nDefault: front\nSince: 2.11.0",
        "values": [
          {
            "name": "front",
            "description": "前置"
          },
          {
            "name": "back",
            "description": "后置"
          }
        ]
      },
      {
        "name": "mode",
        "description": "Type: string\nDefault: camera\nSince: 2.11.0",
        "values": [
          {
            "name": "camera",
            "description": "自身传入 camera"
          },
          {
            "name": "video",
            "description": "其他用户传入 video"
          }
        ]
      },
      {
        "name": "object-fit",
        "description": "Type: string\nDefault: fill\nSince: 2.29.0",
        "values": [
          {
            "name": "fill",
            "description": "填充"
          },
          {
            "name": "contain",
            "description": "包含"
          },
          {
            "name": "cover",
            "description": "覆盖，安卓暂未支持，iOS 生效"
          }
        ]
      },
      {
        "name": "openid",
        "description": "Type: string\nSince: 2.11.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/voip-room.html"
      }
    ]
  }
]
