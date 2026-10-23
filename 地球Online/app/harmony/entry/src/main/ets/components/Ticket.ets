import { Trip } from '../model/Spec';
import { Theme } from '../theme/Theme';
import { I18n } from '../i18n/I18n';
import { Tag } from './Controls';
import { FONT_SUB } from '../gen/Shared';

/** 两段文字算不算重复：去掉标点后一个包含另一个，或共用任意一个 2 字以上的词（与网页 ticket.ts 的 dup 同一套） */
export function dupText(a: string, b: string): boolean {
  const sep = /[\s·、，,+＋\-–—/／()（）]+/;
  const na = a.split(sep).join(''), nb = b.split(sep).join('');
  if (na.length === 0 || nb.length === 0) return false;
  if (na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0) return true;
  const wb: string[] = b.split(sep).filter((w: string) => w.length >= 2);
  return a.split(sep).filter((w: string) => w.length >= 2).some((w: string) => wb.indexOf(w) >= 0);
}

/** 票号：种子取后四位（与网页 ticket.ts 的 serial 同一个数） */
export function serialOf(trip: Trip): string {
  const n = String(Math.abs(Math.floor(trip.seed)) % 10000);
  return I18n.t1('ticket.serial', 'n', '0000'.substring(n.length) + n);
}

/** 票（D74）：每一趟旅程都是一张白底墨字的纸票，与网页 ticket.ts、iOS TicketView 是同一张。
 *  票面：一行印章式的小字（地球Online + 票号）加状态标签；大标题是地点；底下一行小字是书名与日期（或调用方给的一行）；
 *  票根竖着印一行（凭票进入 / 天数），底下一个很淡的年份水印。点票面 = 翻开这本书；撕票根 = 这一刻最要紧的事（先放撕的动画）。
 *  纸面（四角与撕线上下的缺口、虚线、颗粒）用 Canvas 画：destination-out 挖缺口，比 clipShape 的路径接口稳。
 *  票是物件，不是界面：标题用 22 粗（与网页 / iOS 的票一致），其余只有 13。 */
@Component
export struct Ticket {
  @Prop trip: Trip;
  @Prop status: string = '';
  @Prop live: boolean = false;
  @Prop lines: string[] = [];
  @Prop compact: boolean = false;
  @Prop stubLabel: string = '';
  @Prop stubEnabled: boolean = true;
  onFace: () => void = () => {};
  onStub: () => void = () => {};

  @State private w: number = 0;
  @State private h: number = 0;
  @State private tearing: boolean = false;
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private ctx: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);
  private canvasReady: boolean = false;

  private stubW(): number { return this.compact ? 56 : 76; }

  private place(): string {
    const d = I18n.plainNames(this.trip.destination);
    return d.length > 0 ? d : I18n.plain(this.trip.title);
  }

  private bodyLines(): string[] {
    if (this.lines.length > 0) return this.lines;
    const title = I18n.plain(this.trip.title);
    const name = dupText(title, this.place()) ? '' : title;
    const span = I18n.fullDateRange(this.trip.startDate, this.trip.endDate);
    return [name.length > 0 ? name + ' · ' + span : span];
  }

  private stubText(): string {
    if (this.stubLabel !== '') return this.stubLabel;
    return this.compact ? I18n.days(this.trip.days.length) : I18n.t('ticket.admit');
  }

  /** 白纸 + 颗粒 + 四角与撕线上下的缺口 + 虚线撕线 */
  private paint(): void {
    if (!this.canvasReady || this.w <= 0 || this.h <= 0) return;
    const c = this.ctx, w = this.w, h = this.h;
    const notch = 10, perf = 7, sx = w - this.stubW();
    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, w, h);
    // 颗粒：确定性的小点（种子 = 书的种子），淡到只是纸感
    let s = Math.abs(Math.floor(this.trip.seed)) % 2147483647 + 1;
    c.fillStyle = 'rgba(29,30,35,0.05)';
    const dots = Math.floor((w * h) / 90);
    for (let i = 0; i < dots; i++) {
      s = (s * 16807) % 2147483647; const x = (s / 2147483647) * w;
      s = (s * 16807) % 2147483647; const y = (s / 2147483647) * h;
      c.fillRect(x, y, 1, 1);
    }
    // 缺口
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.moveTo(notch, 0); c.arc(0, 0, notch, 0, Math.PI * 2);
    c.moveTo(w + notch, 0); c.arc(w, 0, notch, 0, Math.PI * 2);
    c.moveTo(notch, h); c.arc(0, h, notch, 0, Math.PI * 2);
    c.moveTo(w + notch, h); c.arc(w, h, notch, 0, Math.PI * 2);
    c.moveTo(sx + perf, 0); c.arc(sx, 0, perf, 0, Math.PI * 2);
    c.moveTo(sx + perf, h); c.arc(sx, h, perf, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    // 撕线
    c.strokeStyle = 'rgba(29,30,35,0.22)';
    c.lineWidth = 2;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.moveTo(sx, perf + 3);
    c.lineTo(sx, h - perf - 3);
    c.stroke();
    c.setLineDash([]);
  }

  private tear(): void {
    if (!this.stubEnabled || this.tearing) return;
    this.getUIContext().animateTo({ duration: 500, curve: Curve.EaseOut }, () => { this.tearing = true; });
    setTimeout(() => { this.onStub(); this.tearing = false; }, 420);
  }

  build() {
    Stack() {
      Canvas(this.ctx)
        .width('100%').height('100%')
        .onReady(() => { this.canvasReady = true; this.paint(); })
      Row() {
        // 票面
        Column({ space: this.compact ? 2 : 6 }) {
          Row({ space: 8 }) {
            if (this.status === '' || this.compact) {
              Text(I18n.t('app.name')).fontSize(FONT_SUB).fontWeight(FontWeight.Medium).fontColor(Theme.ticketInk2).maxLines(1)
            }
            Text(serialOf(this.trip)).fontSize(FONT_SUB).fontColor(Theme.ticketInk2).letterSpacing(0.8).maxLines(1)
            Blank()
            if (this.status !== '') {
              Tag({ text: this.status, live: this.live })
            }
          }
          .width('100%')
          Text(this.place())
            .fontSize(this.compact ? 17 : 22)
            .fontWeight(FontWeight.Bold)
            .fontColor(Theme.ticketInk)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          ForEach(this.bodyLines(), (l: string, i: number) => {
            Text(l).fontSize(FONT_SUB).fontColor(Theme.ticketInk2).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          }, (l: string, i: number) => i + ':' + l)
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
        .justifyContent(FlexAlign.SpaceBetween)
        .padding({ left: this.compact ? 16 : 18, right: 12, top: this.compact ? 10 : 14, bottom: this.compact ? 10 : 14 })
        .height('100%')
        .accessibilityText(I18n.t1('ticket.open', 'title', I18n.plain(this.trip.title)))
        .onClick(() => this.onFace())
        // 票根：竖着的印字 + 年份水印
        Stack() {
          Text(this.trip.startDate.substring(0, 4))
            .fontSize(this.compact ? 28 : 40)
            .fontWeight(FontWeight.Medium)
            .fontColor('rgba(29,30,35,0.07)')
            .maxLines(1)
            .textAlign(TextAlign.Center)
            .width(Math.max(0, this.h - 8))
            .rotate({ angle: 90 })
          Text(this.stubText())
            .fontSize(FONT_SUB)
            .fontWeight(FontWeight.Medium)
            .fontColor(Theme.ticketInk)
            .letterSpacing(1.2)
            .maxLines(1)
            .textAlign(TextAlign.Center)
            .width(Math.max(0, this.h - 20))
            .rotate({ angle: 90 })
        }
        .width(this.stubW())
        .height('100%')
        .rotate({ angle: this.tearing ? 14 : 0, centerX: 0, centerY: '100%' })
        .translate({ x: this.tearing ? 30 : 0, y: this.tearing ? 16 : 0 })
        .opacity(this.tearing ? 0 : 1)
        .accessibilityText(this.stubText())
        .onClick(() => this.tear())
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height(this.compact ? 88 : 132)
    .shadow({ radius: this.compact ? 8 : 12, color: 'rgba(29,30,35,0.2)', offsetX: 0, offsetY: this.compact ? 4 : 8 })
    .onAreaChange((_o: Area, n: Area) => {
      this.w = n.width as number;
      this.h = n.height as number;
      this.paint();
    })
  }
}
