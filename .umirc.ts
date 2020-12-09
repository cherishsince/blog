import { defineConfig } from 'dumi';

// more config: https://d.umijs.org/config
export default defineConfig({
  title: '我是大叔',
  mode: 'site',
  // 设置路由前缀，通常用于部署到非根目录。
  base: '/',
  publicPath: '/',
  locales: [],
  // 按需加载
  dynamicImport: {},
  // 服务器渲染，静态html
  ssr: {
    forceInitial: false,
    // removeWindowInitialProps: false,
    devServerRender: true,
    mode: 'string',
    staticMarkup: true,
  },
  exportStatic: {},
});
