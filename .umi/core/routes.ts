// @ts-nocheck
import { ApplyPluginsType } from 'D:/Projects/blog/node_modules/@umijs/runtime';
import { plugin } from './plugin';

const routes = [
  {
    "path": "/",
    "component": (props) => require('react').createElement(require('../../node_modules/@umijs/preset-dumi/lib/themes/default/layout.js').default, {
      ...{"menus":{"*":{"*":[{"path":"/","title":"必看说明","meta":{}},{"path":"/容器刷新-1-perpare-refresh","title":"容器刷新-1-perpareRefresh","meta":{}},{"path":"/容器刷新-2-obtain-fresh-bean-factory","title":"容器刷新-2-obtainFreshBeanFactory","meta":{}},{"path":"/容器刷新-2-xml路线-1-load-bean-definitions","title":"Xml路线-1-loadBeanDefinitions","meta":{}}]}},"locales":[],"navs":{},"title":"dumi","mode":"doc"},
      ...props,
    }),
    "routes": [
      {
        "path": "/",
        "component": require('../../docs/index.md').default,
        "exact": true,
        "meta": {
          "filePath": "docs/index.md",
          "updatedTime": 1594779057635,
          "slugs": [
            {
              "depth": 1,
              "value": "必看说明",
              "heading": "必看说明"
            }
          ],
          "title": "必看说明"
        },
        "title": "必看说明"
      },
      {
        "path": "/容器刷新-1-perpare-refresh",
        "component": require('../../docs/容器刷新-1-perpareRefresh.md').default,
        "exact": true,
        "meta": {
          "filePath": "docs/容器刷新-1-perpareRefresh.md",
          "updatedTime": 1594778948272,
          "slugs": [
            {
              "depth": 1,
              "value": "容器刷新-1-perpareRefresh",
              "heading": "容器刷新-1-perparerefresh"
            }
          ],
          "title": "容器刷新-1-perpareRefresh"
        },
        "title": "容器刷新-1-perpareRefresh"
      },
      {
        "path": "/容器刷新-2-obtain-fresh-bean-factory",
        "component": require('../../docs/容器刷新-2-obtainFreshBeanFactory.md').default,
        "exact": true,
        "meta": {
          "filePath": "docs/容器刷新-2-obtainFreshBeanFactory.md",
          "updatedTime": 1592790013741,
          "slugs": [
            {
              "depth": 1,
              "value": "容器刷新-2-obtainFreshBeanFactory",
              "heading": "容器刷新-2-obtainfreshbeanfactory"
            }
          ],
          "title": "容器刷新-2-obtainFreshBeanFactory"
        },
        "title": "容器刷新-2-obtainFreshBeanFactory"
      },
      {
        "path": "/容器刷新-2-xml路线-1-load-bean-definitions",
        "component": require('../../docs/容器刷新-2-Xml路线-1-loadBeanDefinitions.md').default,
        "exact": true,
        "meta": {
          "filePath": "docs/容器刷新-2-Xml路线-1-loadBeanDefinitions.md",
          "updatedTime": 1592790013741,
          "slugs": [
            {
              "depth": 1,
              "value": "Xml路线-1-loadBeanDefinitions",
              "heading": "xml路线-1-loadbeandefinitions"
            },
            {
              "depth": 5,
              "value": "第11步-解析BeanDefinition",
              "heading": "第11步-解析beandefinition"
            },
            {
              "depth": 5,
              "value": "第11.1-默认解析",
              "heading": "第111-默认解析"
            },
            {
              "depth": 5,
              "value": "第11.1.1 processBeanDefinition",
              "heading": "第1111-processbeandefinition"
            },
            {
              "depth": 5,
              "value": "第11.2-bean标签解析",
              "heading": "第112-bean标签解析"
            },
            {
              "depth": 5,
              "value": "第11.3-将xml解析成AbstractBeanDefinition",
              "heading": "第113-将xml解析成abstractbeandefinition"
            }
          ],
          "title": "Xml路线-1-loadBeanDefinitions"
        },
        "title": "Xml路线-1-loadBeanDefinitions"
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
