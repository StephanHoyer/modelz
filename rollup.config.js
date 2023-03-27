'use strict'

import terser from '@rollup/plugin-terser'
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
    plugins: process.env.TEST ? [] : [terser(), filesize()],
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
      terser(),
      filesize(),
    ],
  },
]
