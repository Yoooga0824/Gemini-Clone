<div align="center">

# 🤖 Gemini AI 聊天应用

### 基于 Google Gemini API 的完整 AI 聊天网页

---

<div align="center">
  
  [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/GourangaDasSamrat/Gemini-Clone)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/GourangaDasSamrat/Gemini-Clone)
  
  <a href="https://geminiclonebygouranga.netlify.app/"><strong>✨ 在线演示 »</strong></a>

</div>
  <p style="margin-top:16px;">
    <a href="https://deepwiki.com/GourangaDasSamrat/Gemini-Clone" title="详细文档">
      <img alt="DeepWiki 文档" src="https://img.shields.io/badge/Documentation-DeepWiki-4B79FF?style=for-the-badge&logo=readthedocs&logoColor=white" />
    </a>
  </p>
  <p><em>更多详细文档、使用指南和配置说明，请访问上方的 DeepWiki 页面。</em></p>
</div>

---
[![Netlify Status](https://api.netlify.com/api/v1/badges/bc4b3983-806a-43bc-8475-e87efc44e157/deploy-status)](https://app.netlify.com/projects/geminiclonebygouranga/deploys)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://choosealicense.com/licenses/mit/)
[![GitHub Stars](https://img.shields.io/github/stars/GourangaDasSamrat/Gemini-Clone?style=social)](https://github.com/GourangaDasSamrat/Gemini-Clone)
[![Made with JavaScript](https://img.shields.io/badge/Made_with-JavaScript-F7DF1E?logo=javascript)](https://www.javascript.com)
[![Code Style](https://img.shields.io/badge/Code_Style-Clean-21BB42.svg)](/)
[![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen.svg?style=flat)](/CONTRIBUTING.md)

</div>

## 📹 演示视频

[Screencast from 2025-06-06 11-43-36.webm](https://github.com/user-attachments/assets/14521c1a-bd84-41b3-bceb-d1817f596a41)

## 📌 项目简介

欢迎使用 Gemini AI 聊天应用！这是一个基于 Google Gemini API 的完整 AI 聊天网页。你可以通过精心设计的响应式界面，体验自然对话、代码辅助和创意内容生成。本项目展示了如何用现代 Web 技术实现 AI 能力。

## ✨ 主要特性

- 🎯 **高度还原 UI** — 精心打磨的界面，贴近 Google Gemini 设计风格
- 📱 **响应式设计** — 适配手机、平板、电脑等各种屏幕尺寸
- 🚀 **性能优化** — 响应迅速，动画流畅
- 🔑 **API 集成** — 预置演示 API Key，可快速测试和部署
- 🎨 **现代界面** — 简洁直观，细节到位
- 🛠️ **开发者友好** — 代码结构清晰，文档完善

## 🎯 核心功能

- 🤖 **AI 智能对话** — 自然语言理解与回复
- 💡 **智能回答** — 上下文相关、信息丰富的 AI 回复
- ⚡ **实时处理** — 即时生成并展示回复内容
- 🔍 **代码智能** — 语法高亮与代码解释
- 📝 **富文本支持** — Markdown 渲染与格式化
- 🛡️ **错误处理** — 优雅的错误恢复与用户提示
- 🌐 **跨平台** — 兼容所有现代浏览器

## 🎓 前端小白必读

如果你刚学前端，可以先理解这三者的分工：

| 技术 | 文件 | 通俗理解 |
|------|------|----------|
| **HTML** | `index.html` | 网页的「骨架」—— 按钮、输入框、聊天区域 |
| **CSS** | `style.css` | 网页的「装修」—— 颜色、间距、动画、布局 |
| **JavaScript** | `script.js` | 网页的「大脑」—— 点击、发请求、处理 AI 回复 |

### 为什么需要本地服务器？

`script.js` 使用了 ES Module（`import config from "./config.js"`）。直接双击打开 `index.html` 可能因浏览器安全限制报错，**推荐使用 `npm start` 启动本地服务器**。

## 🛠️ 技术栈

| 类别 | 技术 |
| ---- | ---- |
| 前端 | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black) |
| 第三方库 | ![Highlight.js](https://img.shields.io/badge/Highlight.js-660066?logo=files&logoColor=white) ![Marked.js](https://img.shields.io/badge/Marked.js-000000?logo=markdown&logoColor=white) |
| UI 组件 | ![Boxicons](https://img.shields.io/badge/Boxicons-2E8B57?logo=bookmeter&logoColor=white) |
| 部署 | ![Netlify](https://img.shields.io/badge/Netlify-00C7B7?logo=netlify&logoColor=white) |
| 版本控制 | ![Git](https://img.shields.io/badge/Git-F05032?logo=git&logoColor=white) ![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white) |

## 📁 项目结构

```
Gemini-Clone/
├── assets/                  # 静态资源目录
│   ├── gemini.svg          # Gemini 图标
│   ├── Logo.png            # 项目 Logo
│   ├── profile.png         # 用户头像
│   ├── boxicons-2.1.4/     # 图标库
│   ├── highlight-js/       # 代码语法高亮
│   └── marked/             # Markdown 解析
├── index.html              # 主 HTML 文件（页面结构）
├── style.css               # 主样式文件（页面外观）
├── script.js               # 主 JavaScript 文件（交互逻辑）
├── config.js               # 配置文件（API 密钥等）
├── package.json            # npm 配置（本地开发服务器）
├── README.md               # 项目说明文档
└── LICENSE.txt             # MIT 开源协议
```

### 建议学习顺序

1. `index.html` — 了解页面有哪些区域
2. `style.css` — 学习布局和暗色/浅色主题
3. `config.js` — 了解 API 配置
4. `script.js` — 学习聊天、API 调用等核心逻辑

## 🚀 快速开始

### 环境要求

- 现代浏览器（Chrome、Edge、Firefox 等）
- [Node.js](https://nodejs.org/)（建议 v16+，用于启动本地服务器）
- Git（可选，用于克隆项目）

### 安装步骤

**1. 克隆项目**

```bash
git clone https://github.com/GourangaDasSamrat/Gemini-Clone.git
```

**2. 进入项目目录**

```bash
cd Gemini-Clone
```

**3. 安装依赖**

```bash
npm install
```

**4. 配置 API Key**

打开 `config.js`，将 `GEMINI_API_KEY` 替换为你自己的密钥：

```javascript
const config = {
  GEMINI_API_KEY: "你的API密钥",  // ← 改这里
  API_BASE_URL: "https://generativelanguage.googleapis.com/v1",
  MODEL_NAME: "gemini-2.0-flash",
  // ...
};
```

**获取 API Key：**
1. 访问 [Google AI Studio](https://aistudio.google.com/apikey)
2. 登录 Google 账号
3. 点击「Create API Key」创建密钥
4. 复制并粘贴到 `config.js`

> 📝 **重要提示：** 项目自带演示用 API Key，仅供测试。正式使用请替换为你自己的密钥。

**5. 启动项目**

```bash
npm start
```

浏览器访问：**http://localhost:3000**

### 在线演示

体验已部署版本：[Gemini Clone 在线演示](https://geminiclonebygouranga.netlify.app/)

## 🔧 常见问题

| 问题 | 解决方法 |
|------|----------|
| 页面空白或报 module 错误 | 不要直接双击 `index.html`，请用 `npm start` |
| AI 不回复 | 检查 `config.js` 中的 API Key 是否正确、是否有额度 |
| 刷新后聊天记录还在吗 | 在，数据保存在浏览器 `localStorage` 中 |
| 想改界面文字/颜色 | 文字改 `index.html`，样式改 `style.css`，逻辑改 `script.js` |

## 🤝 参与贡献

开源社区因贡献而精彩，欢迎任何形式的贡献！

1. Fork 本项目
2. 创建功能分支（`git checkout -b feature/新功能`）
3. 提交更改（`git commit -m '添加某某功能'`）
4. 推送到分支（`git push origin feature/新功能`）
5. 提交 Pull Request

## 📄 开源协议

本项目采用 MIT 协议发布，详见 `LICENSE.txt`。

## ⚠️ 免责声明

本项目为独立创作，与 Google 及官方 Gemini 产品无任何关联、背书或合作关系，仅供学习和演示使用。

## 👤 作者与联系方式

<p align="center">
  <img src="https://i.postimg.cc/KjDqkbXm/1765031414996-3.jpg"
       alt="Gouranga Das Samrat"
       width="120"
       style="border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
</p>

<h3 align="center">Gouranga Das Samrat</h3>

<p align="center">
  <i>
    全栈开发者 • MERN 技术栈 • 技术写作者 <br/>
    热衷于构建可扩展的 Web 应用与开源贡献
  </i>
</p>

<p align="center">
  <a href="https://linkedin.com/in/gouranga-das-samrat">
    <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white"/>
  </a>
  <a href="https://x.com/gouranga_khulna">
    <img src="https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white"/>
  </a>
  <a href="https://bsky.app/profile/gouranga-khulna.bsky.social">
    <img src="https://img.shields.io/badge/Bluesky-0285FF?style=for-the-badge&logo=bluesky&logoColor=white"/>
  </a>
  <a href="https://www.facebook.com/gourangadassamrat">
    <img src="https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white"/>
  </a>
</p>

<p align="center">
  <a href="https://leetcode.com/u/gourangadassamrat/">
    <img src="https://img.shields.io/badge/LeetCode-FFA116?style=for-the-badge&logo=leetcode&logoColor=white"/>
  </a>
  <a href="https://www.hackerrank.com/profile/gouranga_das_kh1">
    <img src="https://img.shields.io/badge/HackerRank-2EC866?style=for-the-badge&logo=hackerrank&logoColor=white"/>
  </a>
  <a href="https://codepen.io/gouranga-das-samrat">
    <img src="https://img.shields.io/badge/CodePen-000000?style=for-the-badge&logo=codepen&logoColor=white"/>
  </a>
</p>

<p align="center">
  <a href="https://medium.com/@gouranga.das.khulna">
    <img src="https://img.shields.io/badge/Medium-12100E?style=for-the-badge&logo=medium&logoColor=white"/>
  </a>
  <a href="https://dev.to/gouranga-das-khulna/">
    <img src="https://img.shields.io/badge/Dev.to-0A0A0A?style=for-the-badge&logo=dev.to&logoColor=white"/>
  </a>
  <a href="mailto:gouranga.samrat@gmail.com">
    <img src="https://img.shields.io/badge/Email-D14836?style=for-the-badge&logo=gmail&logoColor=white"/>
  </a>
</p>

<p align="center">
  <i>
    欢迎合作前端与全栈项目，
    或围绕 JavaScript、React 与 Web 架构展开讨论。
  </i>
</p>

---

## 📊 性能与 Lighthouse 报告

<div align="center">

### 桌面端性能评分

![Performance](https://img.shields.io/badge/Performance-98%25-success?style=for-the-badge&logo=lighthouse&logoColor=white)
![Accessibility](https://img.shields.io/badge/Accessibility-100%25-success?style=for-the-badge&logo=lighthouse&logoColor=white)
![Best Practices](https://img.shields.io/badge/Best%20Practices-100%25-success?style=for-the-badge&logo=lighthouse&logoColor=white)
![SEO](https://img.shields.io/badge/SEO-100%25-success?style=for-the-badge&logo=lighthouse&logoColor=white)

### 关键指标

| 指标 | 得分 |
| ---- | ---- |
| 首次内容绘制 (FCP) | ![FCP](https://img.shields.io/badge/0.8s-success?style=flat-square&logo=lighthouse&logoColor=white) |
| 最大内容绘制 (LCP) | ![LCP](https://img.shields.io/badge/1.2s-success?style=flat-square&logo=lighthouse&logoColor=white) |
| 总阻塞时间 (TBT) | ![TBT](https://img.shields.io/badge/0ms-success?style=flat-square&logo=lighthouse&logoColor=white) |
| 累积布局偏移 (CLS) | ![CLS](https://img.shields.io/badge/0.001-success?style=flat-square&logo=lighthouse&logoColor=white) |
| 速度指数 (SI) | ![SI](https://img.shields.io/badge/1.0s-success?style=flat-square&logo=lighthouse&logoColor=white) |

### 资源体积分析

| 资源 | 大小 |
| ---- | ---- |
| JavaScript | ![JS Size](https://img.shields.io/badge/56.2KB-blue?style=flat-square&logo=javascript&logoColor=white) |
| CSS | ![CSS Size](https://img.shields.io/badge/12.8KB-blue?style=flat-square&logo=css3&logoColor=white) |
| 总计 | ![Total Size](https://img.shields.io/badge/69KB-blue?style=flat-square&logo=files&logoColor=white) |

</div>

## 🌟 支持项目

如果喜欢这个项目，欢迎在 GitHub 上点个 ⭐！

---

## 📢 反馈

有建议或想参与贡献？欢迎提交 Issue，或通过上方社交链接联系作者。

**编程愉快！**
