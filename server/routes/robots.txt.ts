/** robots.txt: index the app, not its API / tile proxy. */
export default defineEventHandler((event) => {
  const site = useRuntimeConfig().public.siteUrl
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /traffic/

Sitemap: ${site}/sitemap.xml
`
})
