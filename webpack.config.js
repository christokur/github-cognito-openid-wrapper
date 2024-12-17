const NodemonPlugin = require('nodemon-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

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
  }
};

const config = [
  {
    ...baseConfig,
    externals: [
      nodeExternals({
        allowlist: ['source-map-support', 'source-map', 'buffer-from']
      }),
      ({ request }, callback) => {
        // Exclude version.js from bundling
        if (/version\.js$/.test(request)) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      }
    ],
    output: {
      libraryTarget: 'commonjs2',
      path: `${__dirname}/dist-lambda`,
      filename: '[name].js', // Output JS files
      sourceMapFilename: '[name].js.map' // Output source maps
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
      filename: '[name].js', // Output JS files
      sourceMapFilename: '[name].js.map' // Output source maps
    },
    entry: {
      server: './src/connectors/web/app.js'
    },
    externals: [nodeExternals()],
    plugins: [new NodemonPlugin()]
  }
];

module.exports = config;
