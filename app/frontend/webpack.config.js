const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    deposits: './src/deposits/index.jsx',
    // Add other entry points for different modules as needed
  },
  output: {
    filename: 'js/[name]/main.js',
    path: path.resolve(__dirname, '../static-files/'),
    publicPath: '/static/',
    clean: false,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name]/[name].css',
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx']
  }
}; 