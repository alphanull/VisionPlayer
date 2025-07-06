import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { ViteRateLimiter } from 'vite-plugin-rate-limiter';
import basicSsl from '@vitejs/plugin-basic-ssl';
import eslint from 'vite-plugin-eslint';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import replaceWithRegex from './plugins/vite-plugin-replace-with-regex.js';
import indexHtmlDevPlugin from './plugins/vite-plugin-dev-index.js';
import inlineCssSourceMapPlugin from './plugins/vite-plugin-inline-css-sourcemap.js';
import hmrStyleImportsPlugin from './plugins/vite-plugin-hmr-style-imports.js';
import customHmrPlugin from './plugins/vite-plugin-custom-hmr.js';
import cleanupMaps from './plugins/vite-plugin-cleanup-maps.js';
import privateObfuscator from './plugins/vite-plugin-private-obfuscator.js';

export default defineConfig(({ command, mode }) => {

    const rootDir = import.meta.dirname,
          env = loadEnv(mode, rootDir, ''),
          [baseMode, format] = mode.split(':'),
          isMjs = format === 'mjs';

    const devPlugins = [
        indexHtmlDevPlugin(env.VITE_DEV_PRIVATE),
        inlineCssSourceMapPlugin(),
        customHmrPlugin(),
        hmrStyleImportsPlugin(),
        ViteRateLimiter({ // can be enabled for testing
            // rate: 600, // kb/s
            // matchOpts: "**/*.mp4"
        }),
        basicSsl()
    ];

    const buildPlugins = [
        { ...eslint({ failOnWarning: false, failOnError: true }) },
        {
            name: 'nullify-hmr-style-imports',
            resolveId(id) { if (id === '/@hmr-style-imports') return id; },
            load(id) { if (id === '/@hmr-style-imports') return 'export default {};'; }
        },
        baseMode === 'secure' ? null : privateObfuscator(),
        cssInjectedByJsPlugin(),
        cleanupMaps(),
        replaceWithRegex([{
            search: /\/\*\*\s*@remove\s*\*[\s\S]*?\*\/\*\*\s*@endremove\s*\*\//gm,
            replace: ''
        }, {
            search: /^.*\/\/\s*@remove\s*$/gm,
            replace: ''
        }, {
            search: /@license\s+MIT/gm,
            replace: ''
        }])
    ];

    const output = format === 'iife'
        ? {
            format: 'iife',
            name: 'VisionPlayer',
            banner: `/*!\n${readFileSync(`${rootDir}/../../LICENSE`, 'utf8')}*/\n\n`,
            footer: readFileSync(`${rootDir}/vipAutoInit.js`, 'utf8')
        }
        : {
            format: 'es',
            banner: `/*!\n${readFileSync(`${rootDir}/../../LICENSE`, 'utf8')}*/\n\n`
        };

    return {
        plugins: command === 'build' ? buildPlugins : devPlugins,
        server: {
            https: true,
            host: true,
            root: '/',
            fs: { allow: ['/'] }
        },
        css: {
            devSourcemap: true,
            preprocessorOptions: {
                scss: {
                    api: 'modern-compiler'
                }
            },
            postcss: `${rootDir}/scripts/build/postcss.config.cjs`
        },
        esbuild: {
            legalComments: 'inline'
        },
        build: {
            target: baseMode === 'secure' ? 'es2022' : 'es2018',
            outDir: 'dist',
            emptyOutDir: false,
            sourcemap: isMjs,
            minify: true,
            lib: {
                entry: `src/builds/VisionPlayer${baseMode === 'default' ? '' : `.${baseMode}`}.js`,
                fileName: () => isMjs
                    ? `mjs/VisionPlayer${baseMode === 'default' ? '' : `.${baseMode}`}.mjs`
                    : `js/VisionPlayer${baseMode === 'default' ? '' : `.${baseMode}`}.min.js`,
                formats: [isMjs ? 'es' : 'iife'],
                name: 'VisionPlayer'
            },
            rollupOptions: { output }
        }
    };
});
