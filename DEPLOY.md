# HTTPS 部署说明

当前目录已经是完整的静态 PWA，可以直接部署。

## Cloudflare Pages

1. 登录 Cloudflare Pages
2. 创建项目
3. 上传 `pink-cat-ledger` 整个目录，或连接 Git 仓库
4. 构建命令留空
5. 输出目录填写 `.`
6. 部署完成后会得到一个 `https://...pages.dev` 地址

## Netlify

1. 登录 Netlify
2. 选择 `Add new site` → `Deploy manually`
3. 把 `pink-cat-ledger` 目录拖进去
4. 部署完成后会得到一个 `https://...netlify.app` 地址

## GitHub Pages

1. 把目录推送到 GitHub 仓库
2. 在仓库 `Settings` → `Pages` 中选择部署分支
3. 选择根目录发布
4. 等待 GitHub 生成 `https://...github.io` 地址

## 部署后需要修改

部署成功后，把新的 HTTPS 地址填写到 iPhone 主屏幕安装流程中即可。

照片和账单数据仍保存在 iPhone 浏览器本地，不会上传到服务器。