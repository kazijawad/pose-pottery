import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import includePaths from 'rollup-plugin-includepaths';

const production = !process.env.ROLLUP_WATCH;

export default {
    input: 'src/main.js',
    output: {
        format: 'iife',
        name: 'app',
        file: 'public/build/bundle.js',
        inlineDynamicImports: true
    },
    plugins: [
        svelte({
            compilerOptions: {
                // Enable run-time checks when not in production
                dev: !production
            }
        }),

        resolve({
            browser: true,
            dedupe: ['svelte']
        }),

        postcss(),

        includePaths({
            paths: ['src'],
            extensions: ['.js', '.glsl']
        })
    ]
};
