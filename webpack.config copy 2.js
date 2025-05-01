// webpack.config.js
const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    mode: isProd ? "production" : "development",
    devtool: isProd ? false : "inline-source-map",

    entry: {
      popup: "./src/popup/js/popup.js",
      options: "./src/options/js/options.js",
      background: "./src/background/background.js",
      content: "./src/content/content.js",
      devtools: ["./src/devtools/js/devtools.js", "./src/devtools/js/panel.js"],
    },

    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js", // ← static names
      assetModuleFilename: "assets/[name][ext]",
    },

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: "babel-loader",
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: "asset",
          parser: { dataUrlCondition: { maxSize: 8 * 1024 } },
        },
        {
          test: /\.(woff2?|eot|ttf|otf)$/i,
          type: "asset/resource",
        },
      ],
    },

    plugins: [
      new CleanWebpackPlugin(),

      new MiniCssExtractPlugin({
        filename: "css/[name].css", // ← static names
      }),

      new CopyWebpackPlugin({
        patterns: [
          { from: "./src/manifest.json", to: "manifest.json" },
          { from: "./src/assets/icons", to: "assets/icons" },
          {
            from: "./src/assets/fontawesome/css",
            to: "assets/fontawesome/css",
          },
          {
            from: "./src/assets/fontawesome/webfonts",
            to: "assets/fontawesome/webfonts",
          },
          { from: "./src/assets/wasm", to: "assets/wasm" },
          { from: "./src/lib", to: "lib" },
          { from: "./src/devtools/js", to: "" },
          { from: "./src/**/css/*", to: "css/[name][ext]" },
        ],
      }),

      // Generate your popup/options/devtools HTML
      ...["popup", "options", "devtools"].map(
        (name) =>
          new HtmlWebpackPlugin({
            template: `./src/${name}/${name}.html`,
            filename: `${name}.html`,
            chunks: [name],
            minify: isProd && {
              removeComments: true,
              collapseWhitespace: true,
            },
          })
      ),

      // Package the dist/ folder into a single ZIP for upload/sideload
      new ZipPlugin({
        path: path.resolve(__dirname, "release"),
        filename: "ura.zip",
      }),
    ],

    resolve: {
      extensions: [".js"],
      alias: { "@": path.resolve(__dirname, "src") },
      fallback: {
        fs: false,
        path: require.resolve("path-browserify"),
        crypto: require.resolve("crypto-browserify"),
        vm: require.resolve("vm-browserify"),
        stream: require.resolve("stream-browserify"),
      },
    },

    optimization: {
      minimize: isProd,
      minimizer: [
        // JS minifier
        "...", // uses default TerserPlugin in Webpack 5+
        // CSS minifier
        "...", // uses default CssMinimizerPlugin if you install it
      ],
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          defaultVendors: { test: /[\\/]node_modules[\\/]/, priority: -10 },
          styles: {
            name: "styles",
            type: "css/mini-extract",
            chunks: "all",
            enforce: true,
          },
        },
      },
      runtimeChunk: "single",
      concatenateModules: true, // scope hoisting
      usedExports: true, // tree-shaking
    },
  };
};
