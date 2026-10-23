import { AppContext } from '../util/Files';

/** 世界层的网页（web/dist，npm run sync:shells 拷进 rawfile/world/）从一个虚拟的 https 源供应：
 *  https://world.earthonline.local/<path> → rawfile/world/<path>（Web 组件的 onInterceptRequest 里同步读）。
 *  这样 ES module、fetch、Worker、IndexedDB 都是同源的 https，不受 resource:// / file:// 的限制。
 *  世界层不连外网：不是这个源的请求一律 404（也就不会意外把行程发出去）。 */
export const WORLD_ORIGIN: string = 'https://world.earthonline.local/';

const MIME: Record<string, string> = {
  'html': 'text/html', 'htm': 'text/html',
  'js': 'text/javascript', 'mjs': 'text/javascript',
  'css': 'text/css',
  'json': 'application/json', 'map': 'application/json',
  'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp', 'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'ttf': 'font/ttf', 'otf': 'font/otf', 'woff': 'font/woff', 'woff2': 'font/woff2',
  'wasm': 'application/wasm',
  'glb': 'model/gltf-binary', 'gltf': 'model/gltf+json',
  'bin': 'application/octet-stream', 'ktx2': 'image/ktx2',
  'txt': 'text/plain', 'md': 'text/plain',
  'mp3': 'audio/mpeg', 'ogg': 'audio/ogg'
};
const TEXT: string[] = ['html', 'htm', 'js', 'mjs', 'css', 'json', 'map', 'svg', 'txt', 'md', 'gltf'];

export class RawfileServer {
  /** 文件扩展名 → MIME（未知的按二进制） */
  static mimeOf(path: string): string {
    const ext = RawfileServer.ext(path);
    const m: string | undefined = MIME[ext];
    return m !== undefined ? m : 'application/octet-stream';
  }

  private static ext(path: string): string {
    const dot = path.lastIndexOf('.');
    return dot >= 0 ? path.substring(dot + 1).toLowerCase() : '';
  }

  /** URL → rawfile 里的路径（去掉源、查询串、锚点；空路径 = embed.html）；不是我们的源返回空串 */
  static pathOf(url: string): string {
    if (!url.startsWith(WORLD_ORIGIN)) return '';
    let p = url.substring(WORLD_ORIGIN.length);
    const q = p.indexOf('?'); if (q >= 0) p = p.substring(0, q);
    const h = p.indexOf('#'); if (h >= 0) p = p.substring(0, h);
    try { p = decodeURIComponent(p); } catch (e) { /* 原样 */ }
    while (p.startsWith('/')) p = p.substring(1);
    if (p === '') p = 'embed.html';
    if (p.indexOf('..') >= 0) return '';
    return 'world/' + p;
  }

  /** Web 组件 onInterceptRequest 的实现：永远返回一个响应（自己的文件 200，其余 404） */
  static respond(url: string): WebResourceResponse {
    const res = new WebResourceResponse();
    const path = RawfileServer.pathOf(url);
    const rm = AppContext.rm();
    if (path !== '' && rm !== null) {
      try {
        const bytes: Uint8Array = rm.getRawFileContentSync(path);
        const buf: ArrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        res.setResponseData(buf);
        res.setResponseMimeType(RawfileServer.mimeOf(path));
        res.setResponseEncoding(TEXT.indexOf(RawfileServer.ext(path)) >= 0 ? 'utf-8' : '');
        res.setResponseCode(200);
        res.setReasonMessage('OK');
        res.setResponseHeader(RawfileServer.headers());
        res.setResponseIsReady(true);
        return res;
      } catch (e) { /* 没有这个文件：落到 404 */ }
    }
    res.setResponseData('');
    res.setResponseMimeType('text/plain');
    res.setResponseEncoding('utf-8');
    res.setResponseCode(404);
    res.setReasonMessage('Not Found');
    res.setResponseIsReady(true);
    return res;
  }

  private static headers(): Array<Header> {
    const a: Header = { headerKey: 'Access-Control-Allow-Origin', headerValue: '*' };
    const b: Header = { headerKey: 'Cache-Control', headerValue: 'no-cache' };
    return [a, b];
  }
}
