const NodemonPlugin = require('nodemon-webpack-plugin');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const baseConfig = {
  mode: 'development',
  target: 'node',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.(key|key.pub)$/,
        use: [
          {
            loader: 'raw-loader'
          }
        ]
      }
    ]
  },
  externals: [
    ({ request }, callback) => {
      // Exclude version.js from bundling
      if (/version\.js$/.test(request)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    }
  ],
  plugins: [
    new webpack.ProvidePlugin({
      'source-map-support': 'source-map-support',
      'source-map': 'source-map',
      'buffer-from': 'buffer-from'
    }),
    process.env.ANALYZE && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-analysis.html',
      openAnalyzer: false
    })
  ].filter(Boolean)
};

const config = [
  {
    ...baseConfig,
    output: {
      libraryTarget: 'commonjs2',
      path: `${__dirname}/dist-lambda`,
      filename: '[name].js', 
      sourceMapFilename: '[name].js.map' 
    },
    entry: {
      openIdConfiguration: './src/connectors/lambda/open-id-configuration.js',
      token: './src/connectors/lambda/token.js',
      userinfo: './src/connectors/lambda/userinfo.js',
      jwks: './src/connectors/lambda/jwks.js',
      authorize: './src/connectors/lambda/authorize.js',
      index: './src/connectors/lambda/index.js'
    }
  },
  {
    ...baseConfig,
    output: {
      libraryTarget: 'commonjs2',
      path: `${__dirname}/dist-web`,
      filename: '[name].js', 
      sourceMapFilename: '[name].js.map' 
    },
    entry: {
      server: './src/connectors/web/app.js'
    },
    plugins: [new NodemonPlugin()]
  }
];

module.exports = config;
