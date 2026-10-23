import { common, Want } from '@kit.AbilityKit';
import { fileIo, fileUri, picker } from '@kit.CoreFileKit';
import { util } from '@kit.ArkTS';
import { resourceManager } from '@kit.LocalizationKit';
import { systemShare } from '@kit.ShareKit';
import { uniformTypeDescriptor } from '@kit.ArkData';
import { pasteboard } from '@kit.BasicServicesKit';

/** 应用的上下文与文件、分享、外链这些和系统打交道的小事（EntryAbility.onCreate 里 init）。 */
export class AppContext {
  static ability: common.UIAbilityContext | null = null;

  static init(ctx: common.UIAbilityContext): void { AppContext.ability = ctx; }

  static rm(): resourceManager.ResourceManager | null {
    return AppContext.ability !== null ? AppContext.ability.resourceManager : null;
  }

  static filesDir(): string { return AppContext.ability !== null ? AppContext.ability.filesDir : ''; }
}

/** UTF-8 字节 → 字符串（decodeWithStream 在 API 12 标了废弃、换成 decodeToString，但仍可用；见 README 的待核对清单） */
export function utf8(bytes: Uint8Array): string {
  const dec = util.TextDecoder.create('utf-8', { ignoreBOM: true });
  return dec.decodeWithStream(bytes, { stream: false });
}

export class Files {
  /** 读 rawfile 里的文本（rawfile/shared/*.json、rawfile/world/...）；没有就抛 */
  static rawText(path: string): string {
    const rm = AppContext.rm();
    if (rm === null) throw new Error('no resource manager');
    return utf8(rm.getRawFileContentSync(path));
  }

  static exists(path: string): boolean {
    try { return fileIo.accessSync(path); } catch (e) { return false; }
  }

  static readText(path: string): string { return fileIo.readTextSync(path); }

  /** 先写临时文件再改名：写到一半被杀掉也不会留下半个 JSON */
  static writeTextAtomic(path: string, text: string): void {
    const tmp = path + '.tmp';
    const f = fileIo.openSync(tmp, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
    try { fileIo.writeSync(f.fd, text); } finally { fileIo.closeSync(f); }
    fileIo.renameSync(tmp, path);
  }

  static writeBytes(path: string, bytes: Uint8Array): void {
    const f = fileIo.openSync(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
    try {
      const buf: ArrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      fileIo.writeSync(f.fd, buf);
    } finally { fileIo.closeSync(f); }
  }

  static readBytes(path: string): Uint8Array {
    const size = fileIo.statSync(path).size;
    const buf = new ArrayBuffer(size);
    const f = fileIo.openSync(path, fileIo.OpenMode.READ_ONLY);
    try { fileIo.readSync(f.fd, buf); } finally { fileIo.closeSync(f); }
    return new Uint8Array(buf);
  }

  static remove(path: string): void {
    try { fileIo.unlinkSync(path); } catch (e) { /* 本来就没有 */ }
  }

  /** 照片小卡的图（D99）：filesDir/cards/<id>.img（PNG 或 JPEG，读的时候看文件头） */
  static cardPath(id: string): string {
    const dir = AppContext.filesDir() + '/cards';
    Files.ensureDir(dir);
    return dir + '/' + Files.safeName(id) + '.img';
  }

  /** 字节 → data URL（PNG 的文件头 89 50 4E 47，其余当 JPEG） */
  static bytesDataUrl(bytes: Uint8Array): string {
    const png = bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    return 'data:' + (png ? 'image/png' : 'image/jpeg') + ';base64,' + new util.Base64Helper().encodeToStringSync(bytes);
  }

  static ensureDir(dir: string): void {
    try { if (!fileIo.accessSync(dir)) fileIo.mkdirSync(dir); } catch (e) { /* 已存在 */ }
  }

  /** 导出目录（filesDir/exports），给分享面板用 */
  static exportDir(): string {
    const dir = AppContext.filesDir() + '/exports';
    Files.ensureDir(dir);
    return dir;
  }

  /** 文件名里不能有的字符换成「_」 */
  static safeName(name: string): string {
    return name.replace(/[\\/:*?"<>|\n\r\t]/g, '_').substring(0, 60);
  }

  /** data:image/png;base64,… → 字节 */
  static dataUrlBytes(dataUrl: string): Uint8Array {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
    return new util.Base64Helper().decodeSync(b64);
  }

  /** 选一个文件（JSON / 行程页 HTML），读成文本；取消返回空串 */
  static async pickText(ctx: common.UIAbilityContext): Promise<string> {
    const opts = new picker.DocumentSelectOptions();
    opts.maxSelectNumber = 1;
    opts.fileSuffixFilters = ['.json', '.html', '.htm', '.txt'];
    const uris: string[] = await new picker.DocumentViewPicker(ctx).select(opts);
    if (uris.length === 0) return '';
    const f = fileIo.openSync(uris[0], fileIo.OpenMode.READ_ONLY);
    try {
      const size = fileIo.statSync(f.fd).size;
      const buf = new ArrayBuffer(size);
      fileIo.readSync(f.fd, buf);
      return utf8(new Uint8Array(buf));
    } finally { fileIo.closeSync(f); }
  }
}

/** 系统分享面板（ShareKit）：图片按 PNG、其余按普通文件 */
export class Share {
  static async file(ctx: common.UIAbilityContext, path: string, png: boolean): Promise<void> {
    const data = new systemShare.SharedData({
      utd: png ? uniformTypeDescriptor.UniformDataType.PNG : uniformTypeDescriptor.UniformDataType.FILE,
      uri: fileUri.getUriFromPath(path)
    });
    const controller = new systemShare.ShareController(data);
    await controller.show(ctx, {
      previewMode: systemShare.SharePreviewMode.DETAIL,
      selectionMode: systemShare.SelectionMode.SINGLE
    });
  }

  /** 复制一段文字（行程数据） */
  static async copy(text: string): Promise<void> {
    const data = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, text);
    await pasteboard.getSystemPasteboard().setData(data);
  }
}

/** 外链（导航）：交给系统浏览器；装了对应的地图 App 时，它们的网页跳转链接会再拉起 App（与 iOS / 网页同一套链接） */
export class Links {
  static async open(ctx: common.UIAbilityContext, url: string): Promise<void> {
    const want: Want = {
      action: 'ohos.want.action.viewData',
      entities: ['entity.system.browsable'],
      uri: url
    };
    await ctx.startAbility(want);
  }
}
