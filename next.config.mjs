/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer, webpack }) => {
    // Add externals for server-side to prevent bundling Node.js modules
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'solc': 'commonjs solc',
        'child_process': 'commonjs child_process',
        'fs': 'commonjs fs',
        'path': 'commonjs path',
        'crypto': 'commonjs crypto',
        'stream': 'commonjs stream',
        'zlib': 'commonjs zlib',
        'util': 'commonjs util',
        'events': 'commonjs events',
        'os': 'commonjs os',
        'http': 'commonjs http',
        'https': 'commonjs https',
        'url': 'commonjs url',
        'assert': 'commonjs assert',
        'debug': 'commonjs debug'
      });
    }

    // Handle Node.js modules in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        url: false,
        zlib: false,
        debug: false,
        util: false,
        buffer: 'buffer',
        events: false,
        'child_process': false,
        'solc': false,
      }
      
      // Add buffer polyfill
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        })
      )
      
      // Handle Cloudflare sockets scheme
      config.module.rules.push({
        test: /cloudflare:sockets/,
        use: 'null-loader'
      })
    }
    
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    }
    
    // Handle RainbowKit and Wagmi modules properly
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    }
    
    return config
  },
  transpilePackages: ['@rainbow-me/rainbowkit', 'wagmi', 'viem']
}

export default nextConfig
