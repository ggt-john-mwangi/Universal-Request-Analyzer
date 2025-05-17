const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const PurgeCSSPlugin = require("purgecss-webpack-plugin");
const glob = require("glob");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const PATHS = { src: path.join(__dirname, "src") };

module.exports = (env, argv) => {
  const isProduction = true; //argv.mode === "production";

  return {
    mode: argv.mode,
    devtool: isProduction ? false : "inline-source-map",
    entry: {
      popup: "./src/popup/js/popup.js",
      options: "./src/options/js/options.js",
      background: "./src/background/background.js",
      content: "./src/content/content.js",
      devtools: "./src/devtools/js/devtools.js", // Separate entry point
      panel: "./src/devtools/js/panel.js", // Separate entry point for panel script
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
          use: [
            MiniCssExtractPlugin.loader, // Ensure this is used to extract CSS
            "css-loader",
          ],
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
      new MiniCssExtractPlugin({
        filename: "styles.css", // Ensure the output CSS file is named correctly
      }),
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
          { from: "./src/devtools/js/**/*", to: "[name][ext]" },
          {
            from: "./src/**/*.css",
            to: "css/[name][ext]",
            globOptions: {
              ignore: ["**/assets/**"],
            },
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
        chunks: ["devtools"], // Only include the devtools script
      }),
      new HtmlWebpackPlugin({
        template: "./src/devtools/panel.html",
        filename: "panel.html", // Output to dist/panel.html
        chunks: ["panel"], // Inject the panel script
      }),
      new PurgeCSSPlugin({
        paths: glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
        safelist: { standard: [/^fa-/, /^icon-/] }, // keep fontawesome/icons if needed
      }),
      new BundleAnalyzerPlugin(),
    ],
    resolve: {
      extensions: [".js"],
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
      fallback: {
        fs: false,
        path: require.resolve("path-browserify"),
        crypto: require.resolve("crypto-browserify"),
        vm: require.resolve("vm-browserify"),
        stream: require.resolve("stream-browserify"),
      },
    },
    optimization: {
      minimize: isProduction,
      minimizer: [
        "...", // keep existing minimizers (like Terser for JS)
        new CssMinimizerPlugin(),
      ],
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
