export interface RouteMatch { name: string; params: Record<string, string> }
export type PageFactory = (params: Record<string, string>, root: HTMLElement) => { leave?: () => void } | void;
const routes: { pattern: RegExp; name: string; keys: string[] }[] = [];
const pages = new Map<string, PageFactory>();
let current: { leave?: () => void } | void;

export function route(name: string, path: string, page: PageFactory) {
  const keys: string[] = []; const pattern = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$");
  routes.push({ pattern, name, keys }); pages.set(name, page);
}
export function match(hash: string): RouteMatch { const p = (hash.replace(/^#/, "") || "/").split("?")[0]; for (const r of routes) { const m = p.match(r.pattern); if (m) return { name: r.name, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; } return { name: "home", params: {} }; }
export function go(path: string) { location.hash = path; }
export function start(root: HTMLElement) {
  const render = () => { current?.leave?.(); root.replaceChildren(); const m = match(location.hash); root.dataset.page = m.name; current = pages.get(m.name)?.(m.params, root); window.scrollTo(0, 0); };
  window.addEventListener("hashchange", render); render();
}
