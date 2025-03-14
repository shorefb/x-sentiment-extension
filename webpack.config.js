const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    content: './src/content.js',
    popup: './src/popup.js',
    background: './src/background.js' // Add background script
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  mode: 'production',
  target: 'web',
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'popup.html', to: 'popup.html' },
        { from: 'gauge-bg.png', to: 'gauge-bg.png' }
      ]
    })
  ],
  optimization: {
    usedExports: true,
    minimize: true
  }
};