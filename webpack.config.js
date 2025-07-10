const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/renderer/index.tsx',
  target: 'electron-renderer',
  devServer: {
    port: 3000,
    hot: true,
    static: {
      directory: path.join(__dirname, 'dist'),
    },
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'src/renderer/tsconfig.json'
            }
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'bundle.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
    }),
  ],
};