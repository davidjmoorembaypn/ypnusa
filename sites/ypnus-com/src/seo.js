'use strict';
/** Meta tags + JSON-LD (Organization, WebSite, WebPage, BreadcrumbList, BlogPosting, FAQPage, Person w/ EducationalOccupationalCredential). */

const abs = (site, u) => (!u ? undefined : /^https?:\/\//.test(u) ? u : `${site.url}${u.startsWith('/') ? '' : '/'}${u}`);

function truncate(s, n) {
  if (!s || s.length <= n) return s || '';
  const cut = s.slice(0, n - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20))}…`;
}

function orgNode(site) {
  return {
    '@type': ['Organization', 'ProfessionalService'],
    '@id': `${site.url}/#organization`,
    name: site.name,
    legalName: site.legalName,
    alternateName: ['YPNUS', 'YPN Inc.'],
    url: `${site.url}/`,
    logo: { '@type': 'ImageObject', url: abs(site, site.logo) },
    image: abs(site, site.logo),
    description: site.tagline,
    email: site.email,
    telephone: site.phoneE164,
    address: { '@type': 'PostalAddress', streetAddress: site.address.street, addressLocality: site.address.city, addressRegion: site.address.region, postalCode: site.address.postalCode, addressCountry: site.address.country },
    areaServed: site.areaServed.map((a) => (a === 'United States' ? { '@type': 'Country', name: a } : { '@type': 'City', name: a })),
    // NMLS #/DRE # are the founder's individual licenses (YPN Inc. is not a lender), so they live on the Person node.
    founder: { '@id': `${site.url}/#founder` },
    sameAs: site.sameAs,
  };
}

function founderNode(site) {
  const f = site.founder;
  return {
    '@type': 'Person',
    '@id': `${site.url}/#founder`,
    name: f.name,
    jobTitle: f.jobTitle,
    url: abs(site, f.url),
    image: abs(site, f.image),
    description: f.bio,
    alumniOf: f.alumniOf ? { '@type': 'CollegeOrUniversity', name: f.alumniOf.name, url: f.alumniOf.url } : undefined,
    worksFor: { '@id': `${site.url}/#organization` },
    knowsAbout: f.knowsAbout || ['Mortgage lending', 'Mortgage lead generation', 'Local SEO for loan officers', 'Realtor co-marketing'],
    identifier: [
      { '@type': 'PropertyValue', propertyID: 'NMLS', value: site.licenses.nmls },
      { '@type': 'PropertyValue', propertyID: 'CA DRE', value: site.licenses.dre },
    ],
    hasCredential: f.credentials.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      name: c.name,
      credentialCategory: c.category,
      ...(c.identifier ? { identifier: c.identifier } : {}),
      ...(c.recognizedBy ? { recognizedBy: { '@type': 'Organization', name: c.recognizedBy, ...(c.recognizedByUrl ? { url: c.recognizedByUrl } : {}) } } : {}),
    })),
  };
}

/** Pages that show the author block (and get Person + author/reviewedBy schema). Opt out with `authorBox: false`. */
const AUTHOR_PREFIXES = ['/vs/', '/ypnus-vs-', '/loan-types/', '/markets/', '/mlo-marketing/', '/features/', '/platform/', '/territory/', '/guides/', '/compare/', '/editorial-policy/', '/research-methodology/'];
function wantsAuthor(doc) {
  if (doc.type === 'post' || doc.authorBox === false) return false;
  if (doc.authorBox === true) return true;
  if (doc.noindex) return false;
  return AUTHOR_PREFIXES.some((p) => doc.permalink.startsWith(p));
}

function breadcrumbs(site, doc, content) {
  const crumbs = [{ name: 'Home', url: '/' }];
  if (doc.type === 'post') {
    crumbs.push({ name: 'Blog', url: '/blog/' });
    const cat = doc.categories[0] && content.categories.get(doc.categories[0]);
    if (cat) crumbs.push({ name: cat.name, url: `/category/${cat.slug}/` });
  } else if (doc.permalink !== '/') {
    const parts = doc.permalink.split('/').filter(Boolean);
    let acc = '/';
    for (const part of parts.slice(0, -1)) {
      acc += `${part}/`;
      const parent = content.byPath.get(acc);
      if (parent) crumbs.push({ name: parent.navTitle || parent.title, url: acc });
    }
  }
  if (doc.permalink !== '/') crumbs.push({ name: doc.title, url: doc.permalink });
  return crumbs;
}

/** Builds everything the <head> needs for a document (page, post or virtual page). */
function buildHead(site, doc, content, extra = {}) {
  const canonical = abs(site, doc.permalink);
  const title = doc.seoTitle || (doc.permalink === '/' ? `${site.name} | ${site.tagline}` : `${doc.title} | ${site.name}`);
  const description = truncate(doc.description || truncate(doc.plainText || '', 158), 160);
  const image = abs(site, doc.ogImage || doc.featuredImage || site.defaultOgImage);
  const crumbs = extra.crumbs || breadcrumbs(site, doc, content);
  const types = new Set(doc.contentSchemaTypes || []);

  const graph = [orgNode(site), {
    '@type': 'WebSite', '@id': `${site.url}/#website`, url: `${site.url}/`, name: site.name, description: site.tagline,
    publisher: { '@id': `${site.url}/#organization` }, inLanguage: 'en-US',
  }];

  const webPage = {
    '@type': doc.permalink === '/about/' || doc.permalink === '/about-david-moore/' ? 'AboutPage' : doc.permalink === '/contact/' ? 'ContactPage' : (extra.collection ? 'CollectionPage' : 'WebPage'),
    '@id': `${canonical}#webpage`, url: canonical, name: title, description,
    isPartOf: { '@id': `${site.url}/#website` }, about: { '@id': `${site.url}/#organization` },
    inLanguage: 'en-US', primaryImageOfPage: image ? { '@type': 'ImageObject', url: image } : undefined,
    datePublished: doc.date ? doc.date.toISOString() : undefined,
    dateModified: doc.modified ? doc.modified.toISOString() : undefined,
    breadcrumb: crumbs.length > 1 ? { '@id': `${canonical}#breadcrumb` } : undefined,
  };
  const authorBox = wantsAuthor(doc);
  if (authorBox) {
    webPage.author = { '@id': `${site.url}/#founder` };
    if (doc.reviewedDate) { webPage.lastReviewed = doc.reviewedDate; webPage.reviewedBy = { '@id': `${site.url}/#founder` }; }
  }
  graph.push(webPage);

  if (crumbs.length > 1 && !types.has('BreadcrumbList')) {
    graph.push({
      '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(site, c.url) })),
    });
  }

  const founderPages = ['/about-david-moore/', '/about/', '/agents/david-j-moore-mba/', '/contact/'];
  if (doc.type === 'post' || authorBox || founderPages.includes(doc.permalink)) graph.push(founderNode(site));

  if (doc.type !== 'post' && doc.schemaType === 'Article') {
    graph.push({
      '@type': 'Article', '@id': `${canonical}#article`, headline: truncate(doc.title, 110), description,
      image: image ? [image] : undefined, datePublished: webPage.datePublished, dateModified: webPage.dateModified,
      author: { '@id': `${site.url}/#founder` }, publisher: { '@id': `${site.url}/#organization` },
      mainEntityOfPage: { '@id': `${canonical}#webpage` }, keywords: doc.focusKeyword || undefined, inLanguage: 'en-US',
    });
  }

  if (doc.type === 'post') {
    graph.push({
      '@type': 'BlogPosting', '@id': `${canonical}#article`, headline: truncate(doc.title, 110), description,
      image: image ? [image] : undefined, datePublished: webPage.datePublished, dateModified: webPage.dateModified,
      author: { '@id': `${site.url}/#founder` }, publisher: { '@id': `${site.url}/#organization` },
      mainEntityOfPage: { '@id': `${canonical}#webpage` }, articleSection: extra.categoryName,
      keywords: doc.focusKeyword || undefined, inLanguage: 'en-US',
    });
  }

  if (doc.faq && doc.faq.length && !types.has('FAQPage')) {
    graph.push({
      '@type': 'FAQPage', '@id': `${canonical}#faq`,
      mainEntity: doc.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }

  if (extra.offers) graph.push(extra.offers);

  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, (k, v) => (v === undefined ? undefined : v))
    .replace(/</g, '\\u003c');

  return {
    title, description, canonical, image, crumbs, jsonLd, authorBox,
    robots: doc.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    ogType: doc.type === 'post' ? 'article' : 'website',
    ogTitle: doc.ogTitle || title, ogDescription: doc.ogDescription || description,
    twitterTitle: doc.twitterTitle || doc.ogTitle || title, twitterDescription: doc.twitterDescription || doc.ogDescription || description,
    published: webPage.datePublished, modified: webPage.dateModified,
  };
}

module.exports = { buildHead, abs, truncate, orgNode, wantsAuthor };
