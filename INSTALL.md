# 德州心法 DSH 快速牌局 · 安装说明

这是 DeepSeek Harness（DSH）的 Client 插件，不是 APK，也不需要 Node/npm。

## 安装

1. 解压整个 `dsh-poker-mind` 文件夹到固定位置，例如：
   `C:\Users\<你的用户名>\dsh-poker-mind`
2. 打开 DeepSeek Harness。
3. 进入 **Plugins / 插件**，点 **Add plugin / 添加插件**。
4. 选择解压后包含 `package.json` 的 `dsh-poker-mind` 文件夹。
5. 确认 `dsh-poker-mind` 已启用，完全退出 DSH 后重新打开。
6. 在任意对话输入框下方点 **♠ 快速牌局**。

## 要求

- 当前桌面版 DSH，支持 `shell.overlay` 与 `conversation.composer.dock` 两个 Client slot。
- 首次加载后如果看不到按钮，先完全退出 DSH 再打开；仅刷新页面可能仍加载旧模块。

## 功能

- 4 人桌：你 + 3 位随机 AI，100BB，1/2 盲注。
- 弃牌 / 过牌 / 跟注 / 加注 / 全下。
- 实时教练：胜率、赔率、补牌、SPR、更优解、范围和位置拆解。
- 亮牌结果页：公共牌、所有人底牌、牌型、赢家。
- 右侧浮动牌桌，左侧聊天仍可使用；关闭后保留当前牌局。
- 牌面：A/K/Q/J/10 + 中央花色符号；对手显示牌背。
- 战绩只存在本机 `localStorage`，不上传。

## 卸载

在 DSH 的 Plugins 页面移除 `dsh-poker-mind`，然后重启 DSH。
