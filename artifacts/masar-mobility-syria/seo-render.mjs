import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export async function renderPublicHtml(vite, shell, route) {
  const { publicPath, siteOrigin, pageMetadata } = await vite.ssrLoadModule('/src/public-seo.ts');
  const url = siteOrigin + publicPath(route.page, route.language);
  const metadata = pageMetadata[route.language][route.page];
  const image = `${siteOrigin}/masar/masar-social.webp`;
  let component;
  if (route.page === 'welcome') {
    const { default: WelcomePage } = await vite.ssrLoadModule('/src/WelcomePage.tsx');
    component = createElement(WelcomePage, { language: route.language });
  } else if (route.page === 'garages') {
    const { PartnerGaragesPage } = await vite.ssrLoadModule('/src/PartnerGaragesPage.tsx');
    component = createElement(PartnerGaragesPage, { language: route.language });
  } else if (route.page === 'membership') {
    const { MembershipPublicPreview } = await vite.ssrLoadModule('/src/MembershipPlans.tsx');
    component = createElement(MembershipPublicPreview, { language: route.language });
  } else {
    const { DemoPreview } = await vite.ssrLoadModule('/src/PublicPreview.tsx');
    component = createElement(DemoPreview, { language: route.language });
  }
  const alternates = ['en', 'ar'].map(lang =>
    `<link rel="alternate" hreflang="${lang}" href="${escapeHtml(siteOrigin + publicPath(route.page, lang))}" />`).join('\n');
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${siteOrigin}/#organization`, name: 'MASAR Mobility Syria', url: `${siteOrigin}/`, logo: `${siteOrigin}/masar/masar-logo.png` },
      { '@type': 'WebSite', '@id': `${siteOrigin}/#website`, name: 'MASAR Mobility Syria', url: `${siteOrigin}/`, publisher: { '@id': `${siteOrigin}/#organization` }, inLanguage: ['en', 'ar'] },
    ],
  };
  const head = `
    <title>${escapeHtml(metadata.title)}</title>
    <meta name="description" content="${escapeHtml(metadata.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    ${alternates}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="MASAR Mobility Syria" />
    <meta property="og:locale" content="${route.language === 'ar' ? 'ar_SY' : 'en_US'}" />
    <meta property="og:title" content="${escapeHtml(metadata.title)}" />
    <meta property="og:description" content="${escapeHtml(metadata.description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:alt" content="MASAR Mobility Syria" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />
    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`;
  return shell
    .replace('<html lang="en">', `<html lang="${route.language}" dir="${route.language === 'ar' ? 'rtl' : 'ltr'}">`)
    .replace('<title>MASAR Mobility Syria</title>', '')
    .replace('<meta name="robots" content="noindex, nofollow" />', '')
    .replace('<!-- PUBLIC_METADATA -->', head)
    .replace('<div id="root"></div>', `<div id="root">${renderToStaticMarkup(component)}</div>`);
}

export async function sitemap(vite) {
  const { siteOrigin, publicPath, publicPages } = await vite.ssrLoadModule('/src/public-seo.ts');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${publicPages.flatMap(page => ['en', 'ar'].map(language => {
    const url = siteOrigin + publicPath(page, language);
    return `  <url><loc>${escapeHtml(url)}</loc>${['en', 'ar'].map(lang => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escapeHtml(siteOrigin + publicPath(page, lang))}" />`).join('')}</url>`;
  })).join('\n')}\n</urlset>\n`;
}