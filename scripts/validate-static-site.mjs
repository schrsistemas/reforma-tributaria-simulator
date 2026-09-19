import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const open = (html.match(/<script\b/gi) ?? []).length;
const close = (html.match(/<\/script>/gi) ?? []).length;
if (open !== 1 || close !== 1) throw new Error(`Expected one script block; got ${open}/${close}`);

const scriptBody = html.match(/<script>([\s\S]*)<\/script>/i)?.[1] ?? '';
new Function(scriptBody);

for (const id of ['simulateBtn','advancePixBtn','resetPixBtn','advanceTefBtn','resetTefBtn','pixGrid','tefGrid','bottomNav']) {
  if (!html.includes(`id="${id}"`) && !html.includes(`class="${id}"`)) throw new Error(`Missing required UI hook: ${id}`);
}
if ((html.match(/onclick=/gi) ?? []).length) throw new Error('Inline onclick handlers are not allowed');
if (/CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)\s*=\s*[^$\s]{4,}/i.test(html)) throw new Error('Possible Cloudflare credential in static site');
if (!html.includes('PORTAL SIMULADOR FACILITADOR')) throw new Error('Facilitator portal title missing');

console.log('Static portal validation passed.');

// CI trigger: keep validation aligned with the single-install-button PWA.
