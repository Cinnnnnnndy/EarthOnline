import { describe, it, expect } from '@ohos/hypium';
import { I18n, Vars } from '../../../main/ets/i18n/I18n';
import { PlayMsg, SetHomeMsg, SetViewMsg, jsLiteral, sendScript } from '../../../main/ets/world/WorldMessages';
import { RawfileServer, WORLD_ORIGIN } from '../../../main/ets/world/RawfileServer';

/** 桥接与消息表的纯函数：format() 的占位规则（与 shared/i18n/i18n.test.ts 同几条）、JS 字符串字面量转义、消息的 JSON 形状、URL → rawfile */
export default function bridgeTest() {
  describe('Bridge', () => {
    it('formatPlaceholders', 0, () => {
      const v: Vars = { 'n': 1, 'title': '京都' };
      expect(I18n.format('{n} {n:day|days}', v)).assertEqual('1 day');
      const v3: Vars = { 'n': 3 };
      expect(I18n.format('{n} {n:day|days}', v3)).assertEqual('3 days');
      expect(I18n.format('下一段：{title}，{n} 天后', v)).assertEqual('下一段：京都，1 天后');
      expect(I18n.format('{missing} 留着', v)).assertEqual('{missing} 留着');
      expect(I18n.format('{{n}}', v)).assertEqual('{1}');
      expect(I18n.format('{n:only}', v)).assertEqual('{n:only}');
      expect(I18n.format('to-{n:do|dos}', v3)).assertEqual('to-dos');
    });

    it('resolveLocale', 0, () => {
      expect(I18n.resolveFrom(['zh-Hant-TW'])).assertEqual('zh-Hans');
      expect(I18n.resolveFrom(['ja-Jpan-JP'])).assertEqual('ja');
      expect(I18n.resolveFrom(['fr-FR', 'en-US'])).assertEqual('en');
      expect(I18n.resolveFrom(['fr-FR'])).assertEqual('en');
      expect(I18n.resolveFrom([])).assertEqual('zh-Hans');
    });

    it('jsLiteralRoundTrip', 0, () => {
      const json = '{"kind":"show-day","t":"他说\\"走\\"\\n\'单引号\' </script> \u2028"}';
      const lit = jsLiteral(json);
      expect(lit.startsWith('"')).assertTrue();
      expect(lit.indexOf('\u2028')).assertEqual(-1);
      expect(JSON.parse(lit) as string).assertEqual(json);
      expect(sendScript([json]).indexOf('w.send(' + lit + ')') >= 0).assertTrue();
    });

    it('messageShapes', 0, () => {
      expect(JSON.stringify(new PlayMsg())).assertEqual('{"kind":"play"}');
      expect(JSON.stringify(new SetHomeMsg(null))).assertEqual('{"kind":"set-home","home":null}');
      expect(JSON.stringify(new SetViewMsg(undefined, false))).assertEqual('{"kind":"set-view","follow":false}');
    });

    it('rawfilePaths', 0, () => {
      expect(RawfileServer.pathOf(WORLD_ORIGIN + 'embed.html?lang=en')).assertEqual('world/embed.html');
      expect(RawfileServer.pathOf(WORLD_ORIGIN)).assertEqual('world/embed.html');
      expect(RawfileServer.pathOf(WORLD_ORIGIN + 'assets/embed-x.js#a')).assertEqual('world/assets/embed-x.js');
      expect(RawfileServer.pathOf('https://example.com/a.js')).assertEqual('');
      expect(RawfileServer.pathOf(WORLD_ORIGIN + '../secret')).assertEqual('');
      expect(RawfileServer.mimeOf('a/b.wasm')).assertEqual('application/wasm');
      expect(RawfileServer.mimeOf('x.glb')).assertEqual('model/gltf-binary');
    });
  });
}
