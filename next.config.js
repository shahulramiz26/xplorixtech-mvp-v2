/** @type {import('next').NextConfig} */
// Core photos and hole data are large and rarely change: let the browser and
// Vercel's edge keep them, so a second visit (or the next screen) does not
// download them again. stale-while-revalidate serves the kept copy at once and
// refreshes it in the background, so a regenerated file still arrives.
const keep = (maxAge, swr) => [{ key: 'Cache-Control', value: `public, max-age=${maxAge}, stale-while-revalidate=${swr}` }]

const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      { source: '/core/photos/:path*', headers: keep(604800, 2592000) },   // 7 days, then refresh in the background
      { source: '/core/:file*.json', headers: keep(3600, 604800) },        // 1 hour, then refresh in the background
      { source: '/landing/:path*', headers: keep(604800, 2592000) },
      { source: '/videos/:path*', headers: keep(604800, 2592000) },
    ]
  },
}

module.exports = nextConfig
