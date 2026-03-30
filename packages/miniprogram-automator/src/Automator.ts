/**
 * @file 小程序自动化入口封装。
 */
import type { IConnectOptions, ILaunchOptions } from './Launcher'
import Element, { ContextElement, CustomElement, InputElement, MovableViewElement, ScrollViewElement, SliderElement, SwiperElement, SwitchElement } from './Element'
import Launcher from './Launcher'
/** Automator 的实现。 */
export default class Automator {
  Element = Element
  CustomElement = CustomElement
  InputElement = InputElement
  ScrollViewElement = ScrollViewElement
  SwiperElement = SwiperElement
  MovableViewElement = MovableViewElement
  SwitchElement = SwitchElement
  SliderElement = SliderElement
  ContextElement = ContextElement
  private launcher = new Launcher()
  async connect(options: IConnectOptions) {
    return await this.launcher.connect(options)
  }

  async launch(options: ILaunchOptions) {
    return await this.launcher.launch(options)
  }
}
