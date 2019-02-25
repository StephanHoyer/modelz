import buble from 'rollup-plugin-buble'
import uglify from 'rollup-plugin-uglify'
import filesize from 'rollup-plugin-filesize'

export default [
  {
    input: './src/index.js',
    output: {
      file: 'modelz.js',
      exports: 'default',
      format: 'umd',
      name: 'modelz',
      sourcemap: true,
    },
    plugins: process.env.TEST ? [] : [buble(), filesize()],
  },
  {
    input: './src/index.js',
    output: {
      file: 'modelz.min.js',
      exports: 'default',
      format: 'umd',
      name: 'modelz',
      sourcemap: true,
    },
    plugins: [
      buble(),
      uglify.uglify({ mangle: true, compress: true }),
      filesize(),
    ],
  },
]
