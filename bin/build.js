const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

function build (directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name)
    if (entry.isDirectory()) build(source)
    else if (entry.name.endsWith('.js')) {
      const target = path.join('build', path.relative('src', source))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, esbuild.transformSync(fs.readFileSync(source, 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs', target: 'node24', sourcefile: source }).code)
    }
  }
}

fs.rmSync('build', { recursive: true, force: true })
build('src')
require('./build-native')()
console.log('Build complete')

async function bundle () {
  await esbuild.build({
    entryPoints: ['src/renderer/main.js'],
    outfile: 'build/browser/main.js',
    bundle: true,
    platform: 'browser',
    format: 'iife',
    loader: { '.js': 'jsx' },
    jsx: 'automatic',
    sourcemap: true,
    define: { 'process.platform': 'window.webtorrent.platform', 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production') },
    plugins: [{
      name: 'application-browser-boundary',
      setup (builder) {
        builder.onResolve({ filter: /^(electron|path)$/ }, args => ({
          path: args.path === 'electron' ? path.resolve('src/renderer/lib/electron-api.js') : require.resolve('pathe')
        }))
        builder.onResolve({ filter: /^\.{1,2}\// }, args => {
          const resolved = path.resolve(args.resolveDir, args.path)
          if (resolved === path.resolve('src/config') || resolved === path.resolve('src/config.js')) {
            return { path: path.resolve('src/renderer/lib/browser-config.js') }
          }
        })
      }
    }]
  })
  await esbuild.build({
    entryPoints: ['src/renderer/preload-main.js', 'src/renderer/preload-about.js'],
    outdir: 'build/renderer',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron']
  })
}
bundle().then(() => console.log('Browser bundle and sandboxed preloads complete'), err => { console.error(err); process.exitCode = 1 })
