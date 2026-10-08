const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (_env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    mode: argv.mode,
    devtool: isProduction ? false : "inline-source-map",
    entry: {
      popup: "./src/popup/js/popup.js",
      options: "./src/options/js/options.js",
      background: "./src/background/background.js",
      content: "./src/content/content.js",
      devtools: "./src/devtools/js/devtools.js",
      panel: "./src/devtools/js/panel.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
            },
          },
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: "asset/resource",
          generator: {
            filename: "images/[name][ext]",
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: "asset/resource",
          generator: {
            filename: "fonts/[name][ext]",
          },
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new MiniCssExtractPlugin({ filename: "styles.css" }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "./src/manifest.json", to: "manifest.json" },
          { from: "./src/assets/icons/**/*", to: "assets/icons/[name][ext]" },
          {
            from: "./src/assets/fontawesome/css/**/*",
            to: "assets/fontawesome/css/[name][ext]",
          },
          {
            from: "./src/assets/fontawesome/webfonts/**/*",
            to: "assets/fontawesome/webfonts/[name][ext]",
          },
          {
            from: "./src/assets/wasm/**/*",
            to: "assets/wasm/[name][ext]",
          },
          { from: "./src/lib/**/*", to: "lib/[name][ext]" },

          { from: "./src/**/css/*", to: "css/[name][ext]" },
          // Section HTML partials (fetched at runtime via chrome.runtime.getURL)
          {
            from: path.resolve(__dirname, "src/options/sections"),
            to: path.resolve(__dirname, "dist/options/sections"),
            noErrorOnMissing: true,
          },
        ],
      }),
      new HtmlWebpackPlugin({
        template: "./src/popup/popup.html",
        filename: "popup.html",
        chunks: ["popup"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/options/options.html",
        filename: "options.html",
        chunks: ["options"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/devtools/devtools.html",
        filename: "devtools.html",
        chunks: ["devtools"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/devtools/panel.html",
        filename: "panel.html",
        chunks: ["panel"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/help/help.html",
        filename: "help/help.html",
        chunks: [],
      }),
      // Package the dist/ folder into a ZIP only on production builds
      ...(isProduction ? [new ZipPlugin({
        path: path.resolve(__dirname, "release"),
        filename: "ura.zip",
      })] : []),
    ],
    resolve: {
      extensions: [".js"],
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
      fallback: {
        fs: false,
        buffer: false,
        path: require.resolve("path-browserify"),
        crypto: require.resolve("crypto-browserify"),
        vm: require.resolve("vm-browserify"),
        stream: require.resolve("stream-browserify"),
      },
    },
    optimization: {
      minimize: isProduction,
      splitChunks: {
        cacheGroups: {
          styles: {
            name: "styles",
            type: "css/mini-extract",
            chunks: "all",
            enforce: true,
          },
        },
      },
    },
  };
};
