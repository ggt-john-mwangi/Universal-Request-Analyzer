const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

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
          { from: "./src/icons/**/*", to: "icons/[name][ext]" },
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
    ],
    resolve: {
      extensions: [".js"],
      alias: {
        "@": path.resolve(__dirname, "src"),
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
