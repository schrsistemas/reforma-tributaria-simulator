import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const open = (html.match(/<script\b/gi) ?? []).length;
const close = (html.match(/<\/script>/gi) ?? []).length;
if (open !== close) throw new Error(`Mismatched script blocks: ${open}/${close}`);

const scriptBodies = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/gi)].map(m => m[1]);
for (const [index, scriptBody] of scriptBodies.entries()) {
  try { new Function(scriptBody); } catch (error) { throw new Error(`JavaScript block ${index + 1} is invalid: ${error.message}`); }
}

for (const id of ['simulateBtn','advancePixBtn','resetPixBtn','advanceTefBtn','resetTefBtn','pixGrid','tefGrid','bottomNav']) {
  if (!html.includes(`id="${id}"`) && !html.includes(`class="${id}"`)) throw new Error(`Missing required UI hook: ${id}`);
}
if ((html.match(/onclick=/gi) ?? []).length) throw new Error('Inline onclick handlers are not allowed');
if (/CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)\s*=\s*[^$\s]{4,}/i.test(html)) throw new Error('Possible Cloudflare credential in static site');
if (!html.includes('PORTAL SIMULADOR FACILITADOR')) throw new Error('Facilitator portal title missing');

console.log('Static portal validation passed.');

// CI trigger: validate the multi-block static portal and single-install-button PWA.
