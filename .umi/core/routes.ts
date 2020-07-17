// @ts-nocheck
import { ApplyPluginsType } from 'D:/Projects/blog/node_modules/@umijs/runtime';
import { plugin } from './plugin';

const routes = [
  {
    "path": "/",
    "component": (props) => require('react').createElement(require('../../node_modules/@umijs/preset-dumi/lib/themes/default/layout.js').default, {
      ...{"menus":{"*":{"*":[{"path":"/","title":"README","meta":{"order":null}},{"title":"Java","path":"/java","meta":{},"children":[{"path":"/java/死磕-class-loader","title":"死磕-ClassLoader","meta":{}}]},{"title":"Spring","path":"/spring","meta":{},"children":[{"path":"/spring","title":"必看说明","meta":{}},{"path":"/spring/容器刷新-1-perpare-refresh","title":"容器刷新-1-perpareRefresh","meta":{}}]}]}},"locales":[],"navs":{},"title":"dumi","mode":"doc"},
      ...props,
    }),
    "routes": [
      {
        "path": "/",
        "component": require('../../README.md').default,
        "exact": true,
        "meta": {
          "locale": "en-US",
          "title": "README",
          "order": null
        },
        "title": "README"
      },
      {
        "path": "/java/死磕-class-loader",
        "component": require('../../docs/java/死磕-ClassLoader.md').default,
        "exact": true,
        "meta": {
          "filePath": "docs/java/死磕-ClassLoader.md",
          "updatedTime": 1594976283810,
          "slugs": [
            {
              "depth": 1,
              "value": "死磕-ClassLoader",
              "heading": "死磕-classloader"
            },
            {
              "depth": 2,
              "value": "是什么",
              "heading": "是什么"
            },
            {
              "depth": 2,
              "value": "延迟加载",
              "heading": "延迟加载"
            },
            {
              "depth": 2,
              "value": "特点",
              "heading": "特点"
            },
            {
              "depth": 1,
              "value": "ClassLoader 传递性",
              "heading": "classloader-传递性"
            },
            {
              "depth": 2,
              "value": "双亲委派",
              "heading": "双亲委派"
            },
            {
              "depth": 2,
              "value": "Class.forName",
              "heading": "classforname"
            },
            {
              "depth": 2,
              "value": "自定义加载器",
              "heading": "自定义加载器"
            },
            {
              "depth": 2,
              "value": "彩蛋",
              "heading": "彩蛋"
            }
          ],
          "title": "死磕-ClassLoader",
          "group": {
            "path": "/java",
            "title": "Java"
          }
        },
        "title": "死磕-ClassLoader"
      },
      {
        "path": "/spring",
        "component": require('../../docs/spring/index.md').default,
        "exact": true,
        "meta": {
          "filePath": "docs/spring/index.md",
          "updatedTime": 1594779057635,
          "slugs": [
            {
              "depth": 1,
              "value": "必看说明",
              "heading": "必看说明"
            }
          ],
          "title": "必看说明",
          "group": {
            "path": "/spring",
            "title": "Spring"
          }
        },
        "title": "必看说明"
      },
      {
        "path": "/spring/容器刷新-1-perpare-refresh",
        "component": require('../../docs/spring/容器刷新-1-perpareRefresh.md').default,
        "exact": true,
        "meta": {
          "filePath": "docs/spring/容器刷新-1-perpareRefresh.md",
          "updatedTime": 1594778948272,
          "slugs": [
            {
              "depth": 1,
              "value": "容器刷新-1-perpareRefresh",
              "heading": "容器刷新-1-perparerefresh"
            }
          ],
          "title": "容器刷新-1-perpareRefresh",
          "group": {
            "path": "/spring",
            "title": "Spring"
          }
        },
        "title": "容器刷新-1-perpareRefresh"
      },
      {
        "path": "/java",
        "meta": {},
        "exact": true,
        "redirect": "/java/死磕-class-loader"
      }
    ],
    "title": "dumi"
  }
];

// allow user to extend routes
plugin.applyPlugins({
  key: 'patchRoutes',
  type: ApplyPluginsType.event,
  args: { routes },
});

export { routes };
