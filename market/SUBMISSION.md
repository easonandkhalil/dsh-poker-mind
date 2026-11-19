# 上架步骤

目标：进入 [`awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的目录，从而在 dshmarket 的 Discover 里被搜到。

## 0. 仓库地址已填好

当前统一使用：

```text
https://github.com/easonandkhalil/dsh-poker-mind
```

已写入：

- `package.json` 的 `repository` / `homepage` / `bugs`
- `market/catalog-entry.yml` 的 `url` / `name` / `icon` / `tarball`
- `README.md` 的 GitHub 安装命令

如果以后改仓库名，这三处要一起改，然后重新生成 tarball（见第 3 步）。

## 1. 建立公开仓库

仓库名建议：`dsh-poker-mind`。  
把本目录（`dsh-poker-mind/`）作为仓库根目录提交，**不要**提交 `node_modules`。

在 GitHub 仓库设置里添加 topic：

```text
dsh-plugin
```

## 2. 确认安装形态

`package.json` 必须保留：

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web", "immediately": true }
}
```

`cordis.patch.yml` 必须是：

```yaml
- insert:
    - id: dsh-poker-mind
      name: dsh-poker-mind
```

在干净 DSH 里至少验证一次：

```bash
dsh plugin add github:easonandkhalil/dsh-poker-mind
```

或 DSH → Plugins → Add plugin → 选择仓库目录。

## 3. 发布 v0.1.2 Release

1. 创建 tag `v0.1.2`；
2. 上传 `dist/dsh-poker-mind-0.1.2.tgz`；
3. 确保浏览器可访问：

```text
https://github.com/easonandkhalil/dsh-poker-mind/releases/download/v0.1.2/dsh-poker-mind-0.1.2.tgz
```

`catalog-entry.yml` 里的 `tarball` 必须与这个地址完全一致。  
如果不想用 Release，可以删除 `tarball:` 行，让市场从 GitHub 源码安装。

## 4. 提交目录 PR

在 `awesome-dsh-plugin` 仓库新增**一个文件**：

```text
data/plugins/easonandkhalil__dsh-poker-mind.yml
```

内容直接用本目录的 `catalog-entry.yml`（已填入 `easonandkhalil`）。  
不要手工改 README；目录 README 会由脚本生成。

PR 要求（CI 会检查）：

- 仓库有 `dsh.bundle`（本项目已满足）；
- 仓库创建满 1 天；
- 仓库有 `dsh-plugin` topic；
- 描述与实际代码一致；
- 一个 PR 最多 3 条。

提交后是 `unconfirmed`，维护者核实后才变 `verified`。收录不是安全审计。

## 5. npm（可选，但推荐）

`dsh-poker-mind` 这个 npm 包名当前未被占用（2026-11-19 查询为 404）。  
如果发布：

```bash
npm publish --access public
```

发布后市场会显示下载量；`package.json` 的 `repository` 必须指回同一个 GitHub 仓库。  
不发 npm 也完全能上架，只是少了下载量。

## 6. DSH Plugin Hub（可选）

另一个入口是 [DSH Plugin Hub](https://dsh-plugin.org/zh/tutorials/publish-plugin-to-hub)：公开仓库 + `dsh-plugin` topic + README 安装命令，提交后自动扫描。和 dshmarket 目录是两套收录，可同时做。
