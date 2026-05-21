# AI News Daily

每天采集 AI 相关新闻进展，并在本地页面展示最新 10 条。

## 环境要求

- Node.js 18 或更高版本

## 使用

```powershell
npm run fetch
npm run serve
```

打开：

```text
http://localhost:4173
```

也可以一步启动：

```powershell
npm start
```

如果你的网络环境会拦截 HTTPS 证书，普通采集可能报证书错误。只在可信网络里使用下面的兼容命令：

```powershell
npm run fetch:insecure
```

## 数据输出

采集结果会写入：

```text
data/news.json
```

页面每次读取该文件，只展示按发布时间和来源类别均衡后的前 10 条。

## 当前采集源

- 公司/实验室：OpenAI Blog、Google DeepMind、Anthropic News、Microsoft AI Blog
- 产业媒体：VentureBeat AI、MIT Technology Review AI、The Decoder
- 高层言论：Dwarkesh Podcast
- 算力生态：NVIDIA Newsroom、NVIDIA Blog
- 视频/访谈：OpenAI YouTube、Google DeepMind YouTube、Anthropic YouTube、NVIDIA Developer YouTube
- 研究论文：arXiv cs.AI

如需新增或删除来源，编辑 `src/fetch-news.js` 里的 `SOURCES` 数组即可。每个来源可以设置 `category`，采集结果会按类别做轻量均衡，避免单一高频来源占满前 10 条。

YouTube 频道可以用 `type: 'youtube'` 接入，脚本会自动解析频道 ID 并读取官方视频 RSS。X 当前没有稳定的公开 RSS；建议后续通过 X API、RSSHub 或可信的 Nitter/RSS 代理接入，不建议直接爬取 X 页面。

## 每天自动采集

### Windows 任务计划程序

可以创建一个每天执行的任务：

```powershell
cd E:\workspace\workspace_vscode\AItools\ai-news-daily
npm run fetch
```

### GitHub Actions

`.github/workflows/pages.yml` 会在每天 08:10（中国时间）自动运行，也可以手动触发。每次部署都会先执行：

```powershell
npm run fetch
npm run build
```

因此 GitHub Pages 发布的 `dist/data/news.json` 会在部署时重新生成，不依赖仓库里旧的 `data/news.json`。
