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

页面每次读取该文件，只展示按发布时间排序后的前 10 条。

## 当前采集源

- OpenAI Blog
- Google DeepMind
- Anthropic News
- Microsoft AI Blog
- VentureBeat AI
- MIT Technology Review AI
- arXiv cs.AI

如需新增或删除来源，编辑 `src/fetch-news.js` 里的 `SOURCES` 数组即可。

## 每天自动采集

### Windows 任务计划程序

可以创建一个每天执行的任务：

```powershell
cd E:\workspace\workspace_vscode\AItools\ai-news-daily
npm run fetch
```

### GitHub Actions

如果后续把项目放到 GitHub，可以增加定时 workflow，每天运行 `npm run fetch` 后提交更新后的 `data/news.json`。
