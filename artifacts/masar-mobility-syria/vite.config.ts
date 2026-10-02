import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { renderPublicHtml, sitemap } from './seo-render.mjs';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    {
      name: 'masar-public-html',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = new URL(req.url || '/', 'http://localhost').pathname;
          if (pathname === '/payment' || pathname === '/payment/') {
            res.writeHead(301, { Location: '/membership' });
            res.end();
            return;
          }
          if (pathname === '/sitemap.xml') {
            try {
              res.setHeader('Content-Type', 'application/xml; charset=utf-8');
              res.end(await sitemap(server));
            } catch (error) { next(error); }
            return;
          }
          // Assets and app routes are handled by Vite as usual.
          if (!req.headers.accept?.includes('text/html')) return next();
          try {
            const { publicRoute } = await server.ssrLoadModule('/src/public-seo.ts');
            const route = publicRoute(pathname);
            if (!route) return next();
            const shell = await readFile(path.resolve(import.meta.dirname, 'index.html'), 'utf8');
            const html = await server.transformIndexHtml(pathname, shell);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(await renderPublicHtml(server, html, route));
          } catch (error) { next(error); }
        });
      },
    },
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
