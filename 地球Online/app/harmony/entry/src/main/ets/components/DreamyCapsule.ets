import { Theme } from '../theme/Theme';
import { iconRes } from './Icons';
import { FONT_SUB, TOUCH } from '../gen/Shared';

/** 一颗星光的位置（相对胶囊的比例）与大小（与 iOS StarGlints 同一组） */
class Glint {
  x: number; y: number; r: number; o: number;
  constructor(x: number, y: number, r: number, o: number) { this.x = x; this.y = y; this.r = r; this.o = o; }
}
const GLINTS: Glint[] = [new Glint(0.08, 0.30, 2.4, 0.9), new Glint(0.22, 0.74, 1.6, 0.7), new Glint(0.47, 0.18, 1.8, 0.8),
  new Glint(0.71, 0.70, 2.2, 0.85), new Glint(0.90, 0.28, 1.5, 0.7)];

/** 「新建旅程」：浮在地球上、不属于任何卡片的胶囊（高 44）——全应用唯一带颜色的按钮。
 *  平涂的「沙画」渐变（蜜 → 晨 → 琥珀，只有晨色一个色相）+ 5 颗白色小星光 + 一道白色的玻璃边；墨色字；深色外观下底深一档。 */
@Component
export struct DreamyCapsule {
  @Prop title: string = '';
  @State w: number = 0;
  @State pressed: boolean = false;
  action: () => void = () => {};

  build() {
    Stack() {
      ForEach(GLINTS, (g: Glint, i: number) => {
        Image(iconRes('sparkle'))
          .width(g.r * 4).height(g.r * 4)
          .fillColor('#FFFFFF')
          .opacity(g.o)
          .position({ x: g.x * this.w - g.r * 2, y: g.y * TOUCH - g.r * 2 })
          .hitTestBehavior(HitTestMode.None)
      }, (g: Glint, i: number) => i + '@' + this.w)
      Row({ space: 10 }) {
        Image(iconRes('sparkle')).width(16).height(16).fillColor(Theme.dreamInk)
        Text(this.title).fontSize(FONT_SUB).fontWeight(FontWeight.Medium).fontColor(Theme.dreamInk).maxLines(1)
      }
      .padding({ left: 22, right: 22 })
      .height(TOUCH)
    }
    .height(TOUCH)
    .borderRadius(TOUCH / 2)
    .linearGradient({ angle: 90, colors: [[Theme.dream()[0], 0], [Theme.dream()[1], 0.5], [Theme.dream()[2], 1]] })
    .border({ width: 1.2, color: 'rgba(255,255,255,0.75)' })
    .shadow({ radius: 18, color: Theme.dark ? 'rgba(0,0,0,0.3)' : 'rgba(230,160,50,0.35)', offsetX: 0, offsetY: 8 })
    .clip(true)
    .scale({ x: this.pressed ? 0.97 : 1, y: this.pressed ? 0.97 : 1 })
    .animation({ duration: 180, curve: Curve.EaseOut })
    .onAreaChange((_o: Area, n: Area) => { this.w = n.width as number; })
    .onTouch((e: TouchEvent) => {
      if (e.type === TouchType.Down) this.pressed = true;
      else if (e.type === TouchType.Up || e.type === TouchType.Cancel) this.pressed = false;
    })
    .accessibilityText(this.title)
    .onClick(() => this.action())
  }
}
