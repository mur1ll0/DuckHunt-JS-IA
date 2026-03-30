'use strict';

var path = require('path');
var CopyPlugin = require('copy-webpack-plugin');

module.exports = function(env, argv) {
  var isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    context: __dirname,
    entry: {
      duckhunt: './main.js',
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: '[name].js',
    },
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
    cache: {
      type: 'filesystem',
    },
    performance: {
      hints: isProduction ? 'warning' : false,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules|src\/workers/,
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            cacheDirectory: true,
          },
        },
        {
          test: /\.(png|mp3|ogg)$/,
          type: 'asset/resource',
        },
      ]
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'src/workers',
            to: 'workers',
          },
        ],
      }),
    ],
    resolve: {
      modules: ['node_modules'],
      extensions: ['.js', '.min.js'],
    },
    devServer: {
      static: path.join(__dirname, 'dist'),
      compress: true,
      port: process.env.PORT || 'auto',
    },
  };
};
