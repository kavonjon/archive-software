const path = require('path');

module.exports = {
  entry: {
    batch: './src/batch/index.js',
    deposits: './src/deposits/index.js'
  },
  output: {
    filename: '[name]-bundle.js',
    path: path.resolve(__dirname, '../static-files/js'),
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      }
    ]
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
  }
};