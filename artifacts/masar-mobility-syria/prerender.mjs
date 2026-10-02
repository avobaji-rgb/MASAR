import { createServer } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderPublicHtml, sitemap } from './seo-render.mjs';

const root = import.meta.dirname;
const vite = await createServer({ configFile: path.join(root, 'vite.config.ts'), optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { siteOrigin, publicPages, publicPath } = await vite.ssrLoadModule('/src/public-seo.ts');
  const shell = await readFile(path.join(root, 'dist/public/index.html'), 'utf8');
  await writeFile(path.join(root, 'dist/public/app.html'), shell.replace('<!-- PUBLIC_METADATA -->', ''));
  for (const language of ['en', 'ar']) for (const page of publicPages) {
    const url = publicPath(page, language);
    const html = await renderPublicHtml(vite, shell, { page, language });
    const target = path.join(root, 'dist/public', url.slice(1), 'index.html');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, html);
  }
  // Keep the historical duplicate readable while pointing crawlers at the preferred URL.
  const paymentPath = path.join(root, 'dist/public/payment/index.html');
  await mkdir(path.dirname(paymentPath), { recursive: true });
  await writeFile(paymentPath, await renderPublicHtml(vite, shell, { page: 'membership', language: 'en' }));
  await writeFile(path.join(root, 'dist/public/sitemap.xml'), await sitemap(vite));
  await writeFile(path.join(root, 'dist/public/robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`);
} finally {
  await vite.close();
}