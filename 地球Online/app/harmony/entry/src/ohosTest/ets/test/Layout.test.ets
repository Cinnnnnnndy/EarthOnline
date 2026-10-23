import { describe, it, expect } from '@ohos/hypium';
import { abilityDelegatorRegistry } from '@kit.TestKit';
import { common } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import { LayoutResult, Posture, ScreenInfo, Segment, layoutOf, worldInsets } from '../../../main/ets/layout/LayoutState';

/** shared/spec/layout.golden.json 的形状（tools/export-shared.ts 原样拷到 rawfile/shared/） */
interface GSeg { x: number; y: number; w: number; h: number }
interface GInput { width: number; height: number; posture?: string; hasOuter?: boolean; segments?: GSeg[] }
interface GExpect { state: string; device?: string; panes?: number; measured?: boolean; creases?: number[] }
interface GCase { name: string; input: GInput; expect: GExpect }
interface GFile { cases: GCase[] }

/** 读 entry 模块的 rawfile：测试 HAP 的应用上下文读不到时，换 entry 模块的上下文（createModuleContext，API 12 起标了废弃但仍可用） */
function readRaw(path: string): string {
  const ctx: common.Context = abilityDelegatorRegistry.getAbilityDelegator().getAppContext();
  let bytes: Uint8Array;
  try {
    bytes = ctx.resourceManager.getRawFileContentSync(path);
  } catch (e) {
    bytes = ctx.createModuleContext('entry').resourceManager.getRawFileContentSync(path);
  }
  return util.TextDecoder.create('utf-8', { ignoreBOM: true }).decodeWithStream(bytes, { stream: false });
}

function toInfo(i: GInput): ScreenInfo {
  const s = new ScreenInfo();
  s.width = i.width;
  s.height = i.height;
  s.posture = (i.posture !== undefined ? i.posture : 'unknown') as Posture;
  s.hasOuter = i.hasOuter === true;
  if (i.segments !== undefined) s.segments = i.segments.map((g: GSeg) => new Segment(g.x, g.y, g.w, g.h));
  return s;
}

/** 一条用例和期望不符的地方（空 = 通过）；带上用例名，失败时一眼看出是哪条 */
function diff(c: GCase, r: LayoutResult): string[] {
  const out: string[] = [];
  const e = c.expect;
  if (r.state !== e.state) out.push(c.name + ': state ' + r.state + ' ≠ ' + e.state);
  if (e.device !== undefined && r.device !== e.device) out.push(c.name + ': device ' + r.device + ' ≠ ' + e.device);
  if (e.panes !== undefined && r.panes.length !== e.panes) out.push(c.name + ': panes ' + r.panes.length + ' ≠ ' + e.panes);
  if (e.measured !== undefined && r.measured !== e.measured) out.push(c.name + ': measured ' + r.measured + ' ≠ ' + e.measured);
  if (e.creases !== undefined && r.creases.join(',') !== e.creases.join(',')) out.push(c.name + ': creases ' + r.creases.join(',') + ' ≠ ' + e.creases.join(','));
  return out;
}

export default function layoutTest() {
  describe('LayoutGolden', () => {
    it('everyGoldenCase', 0, () => {
      const file = JSON.parse(readRaw('shared/layout.golden.json')) as GFile;
      expect(file.cases.length > 0).assertTrue();
      let fails: string[] = [];
      for (const c of file.cases) fails = fails.concat(diff(c, layoutOf(toInfo(c.input))));
      expect(fails.join('\n')).assertEqual('');
    });

    it('panesStayOffCreases', 0, () => {
      const info = new ScreenInfo();
      info.width = 1360; info.height = 950;
      info.segments = [new Segment(0, 0, 450, 950), new Segment(455, 0, 450, 950), new Segment(910, 0, 450, 950)];
      const l = layoutOf(info);
      expect(l.panes[0].x).assertEqual(0);
      expect(l.panes[2].x + l.panes[2].w).assertEqual(1360);
      for (let i = 0; i < l.creases.length; i++) {
        expect(l.panes[i].x + l.panes[i].w <= l.creases[i] - l.gap / 2 + 1).assertTrue();
        expect(l.panes[i + 1].x >= l.creases[i] + l.gap / 2 - 1).assertTrue();
      }
      expect(l.gap >= 21).assertTrue();
      const est = new ScreenInfo();
      est.width = 1440; est.height = 900;
      const e = layoutOf(est);
      expect(e.creases.join(',')).assertEqual('480,960');
      expect(e.gap).assertEqual(24);
      expect(e.panes[1].x).assertEqual(492);
      expect(e.panes[1].w).assertEqual(456);
      expect(e.panes[2].x + e.panes[2].w).assertEqual(1440);
    });

    it('worldInsetsPerState', 0, () => {
      const two = new ScreenInfo(); two.width = 861; two.height = 609;
      const l2 = layoutOf(two);
      expect(worldInsets(l2).left).assertEqual(l2.panes[1].x);
      const three = new ScreenInfo(); three.width = 1440; three.height = 900;
      const i3 = worldInsets(layoutOf(three));
      expect(i3.right > 400 && i3.right < 500).assertTrue();
      const hv = new ScreenInfo(); hv.width = 861; hv.height = 609; hv.posture = 'half';
      expect(worldInsets(layoutOf(hv)).bottom > 250).assertTrue();
      const phone = new ScreenInfo(); phone.width = 390; phone.height = 844;
      expect(worldInsets(layoutOf(phone)).key()).assertEqual('0,0,0,0');
    });
  });
}
