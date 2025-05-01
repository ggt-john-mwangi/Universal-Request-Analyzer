const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    mode: argv.mode,
    devtool: isProduction ? false : "inline-source-map",
    entry: {
      popup: "./src/popup/js/popup.js",
      options: "./src/options/js/options.js",
      background: "./src/background/background.js",
      // contentScript: "./src/content/content.js",
      content: "./src/content/content.js",
      // styles: "./src/styles.css", // Add styles.css as an entry point
      devtools: ["./src/devtools/js/devtools.js", "./src/devtools/js/panel.js"],
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
        // {
        //   test: /\.css$/,
        //   use: [
        //     isProduction ? MiniCssExtractPlugin.loader : "style-loader", // Use MiniCssExtractPlugin.loader in production
        //     "css-loader",
        //   ],
        // },
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
          // { from: "./src/lib/chart.min.js", to: "lib/chart.min.js" },
          { from: "./src/lib/**/*", to: "lib/[name][ext]" },
          { from: "./src/devtools/js/**/*", to: "[name][ext]" },

          { from: "./src/**/css/*", to: "css/[name][ext]" },
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
      // Package the dist/ folder into a single ZIP for upload/sideload
      new ZipPlugin({
        path: path.resolve(__dirname, "release"),
        filename: "ura.zip",
      }),
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
      minimize: isProduction ? true : true,
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
