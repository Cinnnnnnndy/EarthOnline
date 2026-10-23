import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { image } from '@kit.ImageKit';
import { fileIo } from '@kit.CoreFileKit';
import { util } from '@kit.ArkTS';

/** 放一张照片进箱子（D82 / D99）：系统的照片选择器（不要相册权限）选一张，缩到长边 ≤ 1280、按 EXIF 转正，变成 JPEG 的 data URL，
 *  交给嵌入页的 make-card 抠图（网页那套本机抠图，三端同一个结果）。 */
export class Photos {
  /** 选一张；取消返回空串 */
  static async pickOne(): Promise<string> {
    const opts = new photoAccessHelper.PhotoSelectOptions();
    opts.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
    opts.maxSelectNumber = 1;
    const result = await new photoAccessHelper.PhotoViewPicker().select(opts);
    return result.photoUris.length > 0 ? result.photoUris[0] : '';
  }

  /** EXIF 的方向 → 顺时针要转的角度（getImageProperty 回的是 "Right-top" 这类字串） */
  private static degrees(orientation: string): number {
    switch (orientation) {
      case 'Right-top': return 90;
      case 'Bottom-right': return 180;
      case 'Left-bottom': return 270;
      default: return 0;
    }
  }

  static async dataUrl(uri: string, maxSide: number = 1280): Promise<string> {
    const file = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY);
    const src = image.createImageSource(file.fd);
    const packer = image.createImagePacker();
    try {
      const info = await src.getImageInfo();
      const k = Math.min(1, maxSide / Math.max(info.size.width, info.size.height));
      const size: image.Size = { width: Math.max(1, Math.round(info.size.width * k)), height: Math.max(1, Math.round(info.size.height * k)) };
      const opts: image.DecodingOptions = { desiredSize: size };
      const pm = await src.createPixelMap(opts);
      let orientation = '';
      try { orientation = await src.getImageProperty(image.PropertyKey.ORIENTATION); } catch (e) { /* 没有 EXIF */ }
      const deg = Photos.degrees(orientation);
      if (deg !== 0) await pm.rotate(deg);
      const packOpts: image.PackingOption = { format: 'image/jpeg', quality: 90 };
      const buf = await packer.packing(pm, packOpts);
      pm.release();
      return 'data:image/jpeg;base64,' + new util.Base64Helper().encodeToStringSync(new Uint8Array(buf));
    } finally {
      packer.release();
      src.release();
      fileIo.closeSync(file);
    }
  }
}
