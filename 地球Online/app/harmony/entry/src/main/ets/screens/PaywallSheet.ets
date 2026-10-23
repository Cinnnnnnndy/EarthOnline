import { AppModel, SheetRoute } from '../model/AppModel';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { GlassButton, IconButton } from '../components/Controls';
import { iconRes } from '../components/Icons';
import { FONT_BODY, FONT_SUB, SPACE_M } from '../gen/Shared';

/** 一条权益 */
class Benefit {
  icon: string; text: string;
  constructor(icon: string, text: string) { this.icon = icon; this.text = text; }
}

/** 付费墙（占位）：为什么弹出来、Pro 有什么。鸿蒙这版还没接 IAP Kit（华为应用内支付），只说明、不收款。
 *  TODO(payments)：接 @kit.IAPKit：iap.queryProducts / createPurchase（商品 id 与 shared/billing/plans.ts 的 PRODUCT 同一套），
 *  验票后把生效的商品 id 交给 core('entitlement') 得到权益，再用 core('quota') / core('canUse') 判断。 */
@Component
export struct PaywallSheet {
  @Prop route: SheetRoute = new SheetRoute();
  private app: AppModel = AppModel.shared;

  private reason(): string {
    const f = this.route.feature;
    if (f === 'ai') return I18n.tn('pay.reason.ai', 2);
    if (f === 'sync') return I18n.t('pay.reason.sync');
    if (f === 'export') return I18n.t('pay.reason.export');
    return I18n.tn('pay.reason.trips', 3);
  }

  private benefits(): Benefit[] {
    return [
      new Benefit('books', I18n.t('pay.benefit.trips')),
      new Benefit('sparkle', I18n.tn('pay.benefit.ai', 20)),
      new Benefit('globe', I18n.t('pay.benefit.sync')),
      new Benefit('share', I18n.t('pay.benefit.extras'))
    ];
  }

  /** 「这一版还不能在鸿蒙上购买」：消息表里有专门的键就用它，没有先用网页版那句（shared/i18n 待补 pay.harmonyPending） */
  private pending(): string {
    return I18n.t('pay.nativePending');
  }

  build() {
    Column({ space: SPACE_M }) {
      Row({ space: 8 }) {
        Image(iconRes('sparkle')).width(18).height(18).fillColor(Theme.p().mist)
        Text(I18n.t('pay.title')).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink).layoutWeight(1)
        IconButton({ icon: 'close', label: I18n.t('common.close'), plain: true, action: () => this.app.popSheet() })
      }
      .width('100%')
      Text(this.reason()).fontSize(FONT_SUB).fontColor(Theme.p().mist)
      Column({ space: 10 }) {
        ForEach(this.benefits(), (b: Benefit) => {
          Row({ space: 12 }) {
            Image(iconRes(b.icon)).width(20).height(20).fillColor(Theme.p().mist)
            Text(b.text).fontSize(FONT_BODY).fontColor(Theme.p().ink)
          }
        }, (b: Benefit) => b.icon)
      }
      .alignItems(HorizontalAlign.Start)
      .padding({ top: 4, bottom: 4 })
      Text(this.pending()).fontSize(FONT_SUB).fontColor(Theme.p().mist)
      Row() {
        GlassButton({ title: I18n.t('pay.later'), action: () => this.app.popSheet() })
      }
      .width('100%')
      .justifyContent(FlexAlign.End)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
