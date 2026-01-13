/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rhcpwhymdoleobpqfajs.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'rhcpwhymdoleobpqfajs.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54331',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54331',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
}

module.exports = nextConfig
