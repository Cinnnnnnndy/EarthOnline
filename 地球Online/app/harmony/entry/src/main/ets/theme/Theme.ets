import { DAY, NIGHT, Palette, SPACE_BG } from '../gen/Shared';

/** 当前的界面配色（白天 / 夜里两套令牌，gen/Shared.ets 生成）。
 *  深浅一变，Index 用 'eo.uiKey' 把整层界面重建，所以组件里直接读 Theme.p() 就行，不必各自订阅。
 *  规则（ios/README.md 设计要点）：能点的、选中的、路线都是墨（夜里白）；高亮色只有「晨」，只用于「现在」和「去过」；没有紫色。 */
export class Theme {
  static dark: boolean = false;

  static p(): Palette { return Theme.dark ? NIGHT : DAY; }

  /** 地球外的底色（世界层画好之前露出来的颜色） */
  static space(): string {
    const v: string | undefined = SPACE_BG[Theme.dark ? 'night' : 'day'];
    return v !== undefined ? v : '#141a4a';
  }

  /** 卡片、按钮上的阴影 */
  static shadow(): string { return Theme.dark ? 'rgba(0,0,0,0.35)' : 'rgba(30,38,64,0.12)'; }

  /** 墨色胶囊上的字（白天深底白字，夜里白底深字） */
  static onInk(): string { return Theme.dark ? '#141836' : '#FFFFFF'; }

  /** 浮层后面的遮罩 */
  static scrim(): string { return Theme.dark ? 'rgba(0,0,0,0.36)' : 'rgba(20,24,54,0.18)'; }

  // 新建旅程胶囊：全应用唯一带颜色的按钮——蜜 → 晨 → 琥珀，只有晨色一个色相；深色外观下底深一档，字一直是墨（与 iOS Tokens.swift 同值）
  static readonly dreamInk: string = '#1E2640';
  static dream(): string[] {
    return Theme.dark ? ['#EBC25E', '#DFA53C', '#CF8E2C'] : ['#F6D58C', '#F0B84A', '#E6A032'];
  }

  // 票：白纸墨字，深色外观下也一样
  static readonly ticketInk: string = '#1D1E23';
  static readonly ticketInk2: string = '#45464D';
}
