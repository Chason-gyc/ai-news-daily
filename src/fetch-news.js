import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const outputPath = path.join(dataDir, 'news.json');
const gpuRankingPath = path.join(dataDir, 'gpu-ranking.json');
const modelRankingPath = path.join(dataDir, 'model-ranking.json');
const execFileAsync = promisify(execFile);

const MAX_ITEMS = 10;
const TRANSLATE_TARGET = 'zh-CN';
const TRANSLATE_DELAY_MS = Number(process.env.AI_NEWS_TRANSLATE_DELAY_MS || 350);
const ENABLE_TRANSLATION = process.env.AI_NEWS_TRANSLATE !== '0';
const CATEGORY_LIMITS = {
  '公司/实验室': 4,
  '产业媒体': 3,
  '研究论文': 3,
  '高层言论': 2,
  '算力生态': 2,
  '视频/访谈': 2
};
const allowInsecureTls =
  process.argv.includes('--insecure-tls') || process.env.AI_NEWS_INSECURE_TLS === '1';

if (allowInsecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const SOURCES = [
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/news/rss.xml',
    homepage: 'https://openai.com/news/',
    category: '公司/实验室'
  },
  {
    name: 'Google DeepMind',
    url: 'https://deepmind.google/discover/blog/rss.xml',
    homepage: 'https://deepmind.google/discover/blog/',
    category: '公司/实验室'
  },
  {
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/news/rss.xml',
    homepage: 'https://www.anthropic.com/news',
    category: '公司/实验室'
  },
  {
    name: 'Microsoft AI Blog',
    url: 'https://blogs.microsoft.com/ai/feed/',
    homepage: 'https://blogs.microsoft.com/ai/',
    category: '公司/实验室'
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed/',
    homepage: 'https://venturebeat.com/category/ai/',
    category: '产业媒体'
  },
  {
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
    homepage: 'https://www.technologyreview.com/topic/artificial-intelligence/',
    category: '产业媒体'
  },
  {
    name: 'arXiv cs.AI',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    homepage: 'https://arxiv.org/list/cs.AI/recent',
    category: '研究论文'
  },
  {
    name: 'The Decoder',
    url: 'https://the-decoder.com/feed/',
    homepage: 'https://the-decoder.com/',
    category: '产业媒体'
  },
  {
    name: 'Dwarkesh Podcast',
    url: 'https://api.substack.com/feed/podcast/69345.rss',
    homepage: 'https://www.dwarkesh.com/',
    category: '高层言论'
  },
  {
    name: 'NVIDIA Newsroom',
    url: 'https://nvidianews.nvidia.com/releases.xml',
    homepage: 'https://nvidianews.nvidia.com/',
    category: '算力生态'
  },
  {
    name: 'NVIDIA Blog',
    url: 'https://feeds.feedburner.com/nvidiablog',
    homepage: 'https://blogs.nvidia.com/',
    category: '算力生态'
  },
  {
    name: 'OpenAI YouTube',
    type: 'youtube',
    url: 'https://www.youtube.com/@OpenAI',
    homepage: 'https://www.youtube.com/@OpenAI',
    category: '视频/访谈'
  },
  {
    name: 'Google DeepMind YouTube',
    type: 'youtube',
    url: 'https://www.youtube.com/@googledeepmind',
    homepage: 'https://www.youtube.com/@googledeepmind',
    category: '视频/访谈'
  },
  {
    name: 'Anthropic YouTube',
    type: 'youtube',
    url: 'https://www.youtube.com/@anthropic-ai',
    homepage: 'https://www.youtube.com/@anthropic-ai',
    category: '视频/访谈'
  },
  {
    name: 'NVIDIA Developer YouTube',
    type: 'youtube',
    url: 'https://www.youtube.com/@NVIDIADeveloper',
    homepage: 'https://www.youtube.com/@NVIDIADeveloper',
    category: '视频/访谈'
  }
];

const GPU_MODELS = [
  {
    name: 'NVIDIA GB200 / B200 NVL72',
    vendor: 'NVIDIA',
    vramGb: 72 * 180,
    bandwidthTbps: 72 * 8,
    lowPrecisionScore: 10,
    ecosystemScore: 10,
    trainingScore: 10,
    inferenceScore: 10,
    bestFor: '超大模型训练、万亿参数推理',
    specs: [
      { label: '显存', value: '机柜级 HBM3E' },
      { label: '互联', value: '72 GPU NVLink 域' },
      { label: '低精度', value: 'FP8 / FP4' },
      { label: '生态', value: 'CUDA 最成熟' }
    ],
    reason: '当前 NVIDIA 最高端的大模型平台之一，强项是多卡互联、推理吞吐和完整软件栈。'
  },
  {
    name: 'NVIDIA B200',
    vendor: 'NVIDIA',
    vramGb: 180,
    bandwidthTbps: 8,
    lowPrecisionScore: 10,
    ecosystemScore: 10,
    trainingScore: 9.7,
    inferenceScore: 9.8,
    bestFor: '大模型训练、推理',
    specs: [
      { label: '显存', value: '约 180GB HBM3E' },
      { label: '带宽', value: '约 8TB/s' },
      { label: '低精度', value: 'FP8 / FP4' },
      { label: '生态', value: 'CUDA / TensorRT' }
    ],
    reason: 'Blackwell 单卡/节点级核心选择，推理和训练都很强，生态优势明显。'
  },
  {
    name: 'AMD Instinct MI355X',
    vendor: 'AMD',
    vramGb: 288,
    bandwidthTbps: 8,
    lowPrecisionScore: 9.5,
    ecosystemScore: 7.6,
    trainingScore: 9,
    inferenceScore: 9.6,
    bestFor: '大模型训练、长上下文推理',
    specs: [
      { label: '显存', value: '288GB HBM3E' },
      { label: '带宽', value: '约 8TB/s' },
      { label: '低精度', value: 'FP8 / FP6 / FP4' },
      { label: '生态', value: 'ROCm' }
    ],
    reason: '显存容量非常强，适合更大模型和长上下文；主要风险是 ROCm 适配和调优成本。'
  },
  {
    name: 'NVIDIA H200',
    vendor: 'NVIDIA',
    vramGb: 141,
    bandwidthTbps: 4.8,
    lowPrecisionScore: 8.7,
    ecosystemScore: 10,
    trainingScore: 8.8,
    inferenceScore: 9.2,
    bestFor: '大模型推理、训练',
    specs: [
      { label: '显存', value: '141GB HBM3E' },
      { label: '带宽', value: '4.8TB/s' },
      { label: '低精度', value: 'FP8 / BF16' },
      { label: '生态', value: 'CUDA 成熟' }
    ],
    reason: '比 H100 更适合 70B、百B级模型推理和长上下文服务。'
  },
  {
    name: 'AMD Instinct MI325X',
    vendor: 'AMD',
    vramGb: 256,
    bandwidthTbps: 6,
    lowPrecisionScore: 8.8,
    ecosystemScore: 7.4,
    trainingScore: 8.2,
    inferenceScore: 8.9,
    bestFor: '大模型推理、训练',
    specs: [
      { label: '显存', value: '256GB HBM3E' },
      { label: '带宽', value: '约 6TB/s' },
      { label: '低精度', value: 'FP8 / BF16' },
      { label: '生态', value: 'ROCm' }
    ],
    reason: '显存容量领先，适合大模型部署；软件栈要提前验证。'
  },
  {
    name: 'AMD Instinct MI300X',
    vendor: 'AMD',
    vramGb: 192,
    bandwidthTbps: 5.3,
    lowPrecisionScore: 8.6,
    ecosystemScore: 7.2,
    trainingScore: 8,
    inferenceScore: 8.5,
    bestFor: '大模型推理、训练',
    specs: [
      { label: '显存', value: '192GB HBM3' },
      { label: '带宽', value: '约 5.3TB/s' },
      { label: '低精度', value: 'FP8 / BF16' },
      { label: '生态', value: 'ROCm' }
    ],
    reason: '单卡能容纳更大模型，适合推理和微调，但工程适配成本高于 NVIDIA。'
  },
  {
    name: 'NVIDIA H100 SXM',
    vendor: 'NVIDIA',
    vramGb: 80,
    bandwidthTbps: 3.35,
    lowPrecisionScore: 8.5,
    ecosystemScore: 10,
    trainingScore: 8.3,
    inferenceScore: 8,
    bestFor: '主流大模型训练',
    specs: [
      { label: '显存', value: '80GB HBM3' },
      { label: '带宽', value: '3.35TB/s' },
      { label: '低精度', value: 'FP8 / BF16' },
      { label: '生态', value: '事实标准' }
    ],
    reason: '过去几年大模型训练的标准卡，工具链、案例和稳定性最好。'
  },
  {
    name: 'NVIDIA H20',
    vendor: 'NVIDIA',
    vramGb: 96,
    bandwidthTbps: 4,
    lowPrecisionScore: 7.3,
    ecosystemScore: 9.5,
    trainingScore: 6.8,
    inferenceScore: 7.9,
    bestFor: '中国市场推理/训练折中',
    specs: [
      { label: '显存', value: '96GB HBM3' },
      { label: '带宽', value: '约 4TB/s' },
      { label: '低精度', value: 'FP8' },
      { label: '限制', value: '算力受限' }
    ],
    reason: '显存和带宽不错，但算力受出口限制影响，训练价值低于 H100。'
  },
  {
    name: 'NVIDIA A100 80GB',
    vendor: 'NVIDIA',
    vramGb: 80,
    bandwidthTbps: 2,
    lowPrecisionScore: 6.9,
    ecosystemScore: 9.5,
    trainingScore: 7,
    inferenceScore: 6.9,
    bestFor: '微调、训练、推理',
    specs: [
      { label: '显存', value: '80GB HBM2E' },
      { label: '带宽', value: '约 2TB/s' },
      { label: '低精度', value: 'BF16 / FP16' },
      { label: '生态', value: '成熟' }
    ],
    reason: '老但稳定，无 FP8；如果云价格或二手价格合适仍然可用。'
  },
  {
    name: 'RTX PRO 6000 Blackwell',
    vendor: 'NVIDIA',
    vramGb: 96,
    bandwidthTbps: 1.8,
    lowPrecisionScore: 7.7,
    ecosystemScore: 9.5,
    trainingScore: 6.2,
    inferenceScore: 7.5,
    bestFor: '工作站推理、LoRA 微调',
    specs: [
      { label: '显存', value: '96GB GDDR7' },
      { label: '定位', value: '工作站' },
      { label: '低精度', value: 'Blackwell AI' },
      { label: '互联', value: '弱于数据中心卡' }
    ],
    reason: '适合本地单机跑 70B 量化、RAG 和 Agent 服务，不是集群训练首选。'
  },
  {
    name: 'NVIDIA L40S / RTX 6000 Ada',
    vendor: 'NVIDIA',
    vramGb: 48,
    bandwidthTbps: 0.86,
    lowPrecisionScore: 6.4,
    ecosystemScore: 9.3,
    trainingScore: 5.8,
    inferenceScore: 6.8,
    bestFor: '中小模型推理、微调',
    specs: [
      { label: '显存', value: '48GB GDDR6' },
      { label: '定位', value: '推理/图像' },
      { label: '低精度', value: '视型号支持' },
      { label: '生态', value: 'CUDA' }
    ],
    reason: '适合企业推理、图像生成、轻量训练，显存限制比 H 系列明显。'
  },
  {
    name: 'GeForce RTX 5090',
    vendor: 'NVIDIA',
    vramGb: 32,
    bandwidthTbps: 1.8,
    lowPrecisionScore: 7,
    ecosystemScore: 9,
    trainingScore: 5.3,
    inferenceScore: 6.4,
    bestFor: '本地推理、LoRA',
    specs: [
      { label: '显存', value: '32GB GDDR7' },
      { label: '定位', value: '个人开发' },
      { label: '优势', value: '单卡性价比' },
      { label: '限制', value: '显存' }
    ],
    reason: '个人本地开发很强，适合 7B/14B/32B 和部分量化 70B，训练受显存限制。'
  },
  {
    name: 'GeForce RTX 4090',
    vendor: 'NVIDIA',
    vramGb: 24,
    bandwidthTbps: 1,
    lowPrecisionScore: 5.8,
    ecosystemScore: 9,
    trainingScore: 4.8,
    inferenceScore: 5.8,
    bestFor: '本地推理、LoRA',
    specs: [
      { label: '显存', value: '24GB GDDR6X' },
      { label: '定位', value: '个人开发' },
      { label: '优势', value: '性价比' },
      { label: '限制', value: '70B 吃力' }
    ],
    reason: '仍是个人 AI 开发常用卡，适合小中模型和 LoRA，不适合大模型全量训练。'
  }
];

function stripCdata(value) {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function decodeHtml(value = '') {
  return stripCdata(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isProbablyChinese(value = '') {
  return /[\u3400-\u9fff]/.test(value);
}

async function fetchText(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'ai-news-daily/1.0 (+local project)',
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }

    return response.text();
  } catch (error) {
    if (process.platform !== 'win32') {
      throw error;
    }

    return fetchWithPowerShell(url, error);
  }
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  return JSON.parse(text);
}

async function translateText(value) {
  const text = (value || '').trim();
  if (!ENABLE_TRANSLATION || !text || isProbablyChinese(text)) return text;

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text.slice(0, 900));
  url.searchParams.set('langpair', `en|${TRANSLATE_TARGET}`);

  try {
    const data = await fetchJson(url);
    const translated = data?.responseData?.translatedText;
    if (!translated || translated === 'NO QUERY SPECIFIED') return text;
    return decodeHtml(translated);
  } catch (error) {
    console.warn(`Translation failed, keeping original text: ${error.message}`);
    return text;
  } finally {
    await sleep(TRANSLATE_DELAY_MS);
  }
}

async function translateNewsItem(item) {
  const titleOriginal = item.titleOriginal || item.title;
  const summaryOriginal = item.summaryOriginal || item.summary;

  const titleZh = await translateText(titleOriginal);
  const summaryZh = await translateText(summaryOriginal);

  return {
    ...item,
    titleOriginal,
    summaryOriginal,
    title: titleZh,
    summary: summaryZh,
    titleZh,
    summaryZh,
    language: ENABLE_TRANSLATION ? TRANSLATE_TARGET : 'original'
  };
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function getAtomLink(block) {
  const link = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return link ? decodeHtml(link[1]) : '';
}

async function resolveYoutubeFeedUrl(source) {
  const page = await fetchText(source.url);
  const channelId =
    page.match(/"channelId":"([^"]+)"/)?.[1] ||
    page.match(/<meta itemprop="channelId" content="([^"]+)"/i)?.[1] ||
    page.match(/\/channel\/(UC[\w-]+)/)?.[1];

  if (!channelId) {
    throw new Error(`Unable to resolve YouTube channel id for ${source.url}`);
  }

  const feedUrl = new URL('https://www.youtube.com/feeds/videos.xml');
  feedUrl.searchParams.set('channel_id', channelId);
  return feedUrl.toString();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) => {
      parsed.searchParams.delete(key);
    });
    return parsed.toString();
  } catch {
    return url;
  }
}

function parseDate(value) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function parseFeed(xml, source) {
  const rssItems = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomItems = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = rssItems.length > 0 ? rssItems : atomItems;

  return blocks
    .map((block) => {
      const title = getTag(block, 'title');
      const rawLink = getTag(block, 'link') || getAtomLink(block);
      const link = normalizeUrl(rawLink);
      const publishedText =
        getTag(block, 'pubDate') ||
        getTag(block, 'published') ||
        getTag(block, 'updated') ||
        getTag(block, 'dc:date');
      const publishedAt = parseDate(publishedText);
      const summary = getTag(block, 'description') || getTag(block, 'summary') || getTag(block, 'content:encoded');

      return {
        title,
        link,
        source: source.name,
        sourceHome: source.homepage,
        category: source.category,
        summary: summary.slice(0, 240),
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null
      };
    })
    .filter((item) => item.title && item.link);
}

async function fetchSource(source) {
  let xml;
  const url = source.type === 'youtube' ? await resolveYoutubeFeedUrl(source) : source.url;

  try {
    xml = await fetchText(url);
  } catch (error) {
    if (process.platform !== 'win32') {
      throw error;
    }

    xml = await fetchWithPowerShell(url, error);
  }

  return parseFeed(xml, source);
}

async function fetchWithPowerShell(url, originalError) {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '& { [Console]::OutputEncoding = [Text.Encoding]::UTF8; $ProgressPreference = "SilentlyContinue"; (Invoke-WebRequest -Uri $env:AI_NEWS_FETCH_URL -UseBasicParsing -TimeoutSec 30).Content }'
      ],
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          AI_NEWS_FETCH_URL: url
        }
      }
    );

    return stdout;
  } catch (fallbackError) {
    fallbackError.message = `${originalError.message}; PowerShell fallback failed: ${fallbackError.message}`;
    throw fallbackError;
  }
}

async function readPreviousNews() {
  try {
    const content = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function rankItems(items) {
  const seen = new Set();
  const ranked = items
    .filter((item) => {
      const key = item.link || `${item.source}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => parseDate(b.publishedAt) - parseDate(a.publishedAt));

  const selected = [];
  const selectedKeys = new Set();
  const categoryCounts = new Map();

  for (const item of ranked) {
    const category = item.category || '其他';
    const limit = CATEGORY_LIMITS[category] || MAX_ITEMS;
    const count = categoryCounts.get(category) || 0;
    if (count >= limit) continue;

    selected.push(item);
    selectedKeys.add(item.link || `${item.source}:${item.title}`);
    categoryCounts.set(category, count + 1);
    if (selected.length >= MAX_ITEMS) return selected;
  }

  for (const item of ranked) {
    const key = item.link || `${item.source}:${item.title}`;
    if (selectedKeys.has(key)) continue;

    selected.push(item);
    if (selected.length >= MAX_ITEMS) break;
  }

  return selected;
}

async function translateNewsItems(items) {
  const translated = [];
  for (const item of items) {
    translated.push(await translateNewsItem(item));
  }
  return translated;
}

function makeRankedItems(items, scoreKey, limit = items.length) {
  return [...items]
    .sort((a, b) => b[scoreKey] - a[scoreKey])
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      bestFor: item.bestFor,
      specs: item.specs,
      reason: item.reason
    }));
}

function buildGpuRankingPayload() {
  const overall = GPU_MODELS.map((item) => ({
    ...item,
    overallScore:
      item.trainingScore * 0.32 +
      item.inferenceScore * 0.3 +
      Math.min(item.vramGb / 180, 1.2) * 1.2 +
      Math.min(item.bandwidthTbps / 8, 1.2) * 1.1 +
      item.ecosystemScore * 0.18
  }));

  return {
    updatedAt: todayIsoDate(),
    itemsCount: GPU_MODELS.length,
    sourceLabel: '每日刷新：公开规格 + AI 工作负载权重',
    sourceText:
      '显卡榜每天在抓取任务中重算，综合公开规格、显存、带宽、低精度能力、训练/推理适配和软件生态。排名用于 AI 选型参考，不等同于单一游戏或图形 benchmark。',
    sourceChips: ['NVIDIA 官方规格', 'AMD 官方规格', 'AI 推理/训练适配', '显存与带宽', 'CUDA / ROCm 生态'],
    rankings: [
      {
        title: '综合排名',
        description: '训练和推理综合实用价值',
        items: makeRankedItems(overall, 'overallScore')
      },
      {
        title: '训练优先排名',
        description: '更看多卡互联、低精度和生态',
        items: makeRankedItems(overall, 'trainingScore', 6)
      },
      {
        title: '推理优先排名',
        description: '更看显存容量、带宽和部署成熟度',
        items: makeRankedItems(overall, 'inferenceScore', 6)
      }
    ],
    guidance: [
      {
        title: '个人/小团队',
        text: '优先考虑单卡成本和本地可维护性，重点跑 7B、14B、32B、量化 70B 和 LoRA。',
        choices: ['RTX 5090', 'RTX 4090', 'RTX PRO 6000']
      },
      {
        title: '企业推理',
        text: '重点看显存、带宽、稳定性和部署生态。70B 以上模型建议优先 H200、B200 或大显存 AMD。',
        choices: ['B200', 'H200', 'H100', 'MI325X', 'MI355X']
      },
      {
        title: '大模型训练',
        text: '优先选择成熟集群方案，确认多机多卡通信、框架兼容和供应链，再比较单卡理论算力。',
        choices: ['GB200/B200', 'H200/H100 HGX', 'MI355X']
      }
    ]
  };
}

function normalizeArenaModel(row) {
  const model =
    row.model_name ||
    row.model ||
    row.name ||
    row.Model ||
    row['Model'] ||
    row['model_name'] ||
    '';
  const score = Number(row.score || row.rating || row.arena_score || row['Arena Score'] || row['Score'] || 0);
  return {
    model: String(model).trim(),
    score,
    rank: Number(row.rank || row.Rank || 0),
    organization: String(row.organization || row.org || row.provider || '').trim(),
    license: String(row.license || row.model_license || '').trim()
  };
}

function sortArenaModels(models) {
  return models
    .filter((entry) => entry.model && Number.isFinite(entry.score) && entry.score > 0)
    .sort((a, b) => (a.rank || Number.MAX_SAFE_INTEGER) - (b.rank || Number.MAX_SAFE_INTEGER) || b.score - a.score)
    .filter((entry, index, all) => all.findIndex((other) => other.model === entry.model) === index);
}

async function fetchArenaModels(config, category = 'overall') {
  const url = new URL('https://datasets-server.huggingface.co/rows');
  url.searchParams.set('dataset', 'lmarena-ai/leaderboard-dataset');
  url.searchParams.set('config', config);
  url.searchParams.set('split', 'latest');
  url.searchParams.set('offset', '0');
  url.searchParams.set('length', '100');

  try {
    const data = await fetchJson(url);
    const rows = (data.rows || []).map((entry) => entry.row || entry);
    const categoryRows = rows.filter((row) => String(row.category || '').toLowerCase() === category);
    return sortArenaModels((categoryRows.length > 0 ? categoryRows : rows).map(normalizeArenaModel));
  } catch (error) {
    console.warn(`LMArena ${config} leaderboard source failed: ${error.message}`);
    return [];
  }
}

function normalizeOpenModel(row) {
  const model = row?.model?.name || row?.fullname || row?.Model || row?.model || row?.eval_name || '';
  const score = Number(row?.model?.average_score || row?.['Average ⬆️'] || row?.average_score || 0);
  const metadata = row?.metadata || row;
  const features = row?.features || row;
  return {
    model: String(model).trim(),
    score,
    organization: String(row?.organization || row?.provider || '').trim(),
    license: String(metadata?.hub_license || row?.['Hub License'] || '').trim(),
    flagged: features?.is_flagged === true || row?.Flagged === true,
    official: features?.is_official_provider === true || row?.['Official Provider'] === true
  };
}

async function fetchOpenModels() {
  try {
    const data = await fetchJson('https://open-llm-leaderboard-open-llm-leaderboard.hf.space/api/leaderboard/formatted');
    const rows = Array.isArray(data?.models) ? data.models : Array.isArray(data) ? data : [];
    const models = rows
      .map(normalizeOpenModel)
      .filter((entry) => entry.model && Number.isFinite(entry.score) && entry.score > 0 && !entry.flagged && entry.official);
    return models
      .sort((a, b) => b.score - a.score)
      .filter((entry, index, all) => all.findIndex((other) => other.model === entry.model) === index);
  } catch (error) {
    console.warn(`Open LLM Leaderboard source failed: ${error.message}`);
    return [];
  }
}

function modelSpecs(entry, scoreLabel) {
  const lower = entry.model.toLowerCase();
  const family = lower.includes('claude')
    ? 'Anthropic'
    : lower.includes('gemini')
      ? 'Google'
      : lower.includes('gpt') || lower.includes('o3') || lower.includes('o4')
        ? 'OpenAI'
        : lower.includes('deepseek')
          ? 'DeepSeek'
          : lower.includes('qwen')
            ? 'Qwen'
            : lower.includes('llama')
              ? 'Meta'
              : '公开模型';

  const specs = [
    { label: '来源', value: entry.organization || family },
    { label: scoreLabel, value: entry.score ? String(Math.round(entry.score)) : '每日抓取' },
    { label: '类型', value: lower.includes('vision') || lower.includes('gemini') ? '多模态/文本' : '文本/推理' },
    { label: '用途', value: lower.includes('coder') || lower.includes('code') ? '代码优先' : '通用' }
  ];
  if (entry.license) specs.push({ label: '许可证', value: entry.license });
  return specs;
}

function rankingItems(models, limit, bestFor, scoreLabel, sourceName) {
  return models.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    name: entry.model,
    bestFor,
    specs: modelSpecs(entry, scoreLabel),
    reason: `${entry.model} 来自 ${sourceName} 最新公开榜单；不同榜单衡量的任务不同，不应与其他榜单分数直接比较。`
  }));
}

async function buildModelRankingPayload(previousPayload) {
  const [overallModels, codeModels, openModels] = await Promise.all([
    fetchArenaModels('text_style_control'),
    fetchArenaModels('webdev'),
    fetchOpenModels()
  ]);
  const previousRankings = previousPayload?.rankings || [];
  const items = overallModels.length > 0
    ? rankingItems(overallModels, 12, '通用问答、推理与多轮对话', 'Arena 评分', 'LMArena Text Arena')
    : previousRankings[0]?.items || [];
  const codeItems = codeModels.length > 0
    ? rankingItems(codeModels, 8, '网页开发、代码生成与工具调用', 'WebDev 评分', 'LMArena WebDev Arena')
    : previousRankings[1]?.items || [];
  const openItems = openModels.length > 0
    ? rankingItems(openModels, 8, '可自部署、私有化与成本敏感场景', 'Open LLM 评分', 'Hugging Face Open LLM Leaderboard')
    : previousRankings[2]?.items || [];

  return {
    updatedAt: todayIsoDate(),
    itemsCount: new Set([...items, ...codeItems, ...openItems].map((item) => item.name)).size,
    sourceLabel: '任务分榜：LMArena / Hugging Face Open LLM Leaderboard',
    sourceText:
      '综合榜使用 LMArena Text Style Control 的 overall 分类；代码榜使用 LMArena WebDev Arena；开源榜使用 Hugging Face Open LLM Leaderboard，且不会以闭源模型替补。源不可用时仅保留该分类的上次结果。',
    sourceChips: ['LMArena Text Style Control', 'LMArena WebDev Arena', 'Hugging Face Open LLM Leaderboard', '每日自动刷新'],
    rankings: [
      {
        title: '综合能力排名',
        description: 'LMArena Text Style Control · overall',
        items
      },
      {
        title: '代码与 Agent 排名',
        description: 'LMArena WebDev Arena · 代码与工具调用',
        items: codeItems
      },
      {
        title: '开源/可自部署排名',
        description: 'Hugging Face Open LLM Leaderboard · 仅开放权重模型',
        items: openItems
      }
    ],
    guidance: [
      {
        title: '默认高难任务',
        text: '优先选择综合榜靠前且稳定可用的模型，适合复杂分析、长链路代码和 Agent 自动化。',
        choices: items.slice(0, 3).map((item) => item.name)
      },
      {
        title: '代码与工程',
        text: '看代码库理解、补丁稳定性和测试修复能力；成本敏感时可用开源模型做批量辅助。',
        choices: codeItems.slice(0, 4).map((item) => item.name)
      },
      {
        title: '私有化部署',
        text: '优先选开放权重和生态成熟的模型，再按中文、代码、长文本和硬件成本二次筛选。',
        choices: openItems.slice(0, 4).map((item) => item.name)
      }
    ]
  };
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function refreshRankings() {
  const previousModelPayload = await readJsonFile(modelRankingPath);
  const [gpuPayload, modelPayload] = await Promise.all([
    Promise.resolve(buildGpuRankingPayload()),
    buildModelRankingPayload(previousModelPayload)
  ]);

  await Promise.all([
    writeFile(gpuRankingPath, `${JSON.stringify(gpuPayload, null, 2)}\n`, 'utf8'),
    writeFile(modelRankingPath, `${JSON.stringify(modelPayload, null, 2)}\n`, 'utf8')
  ]);

  console.log(`Saved GPU ranking to ${path.relative(rootDir, gpuRankingPath)}`);
  console.log(`Saved model ranking to ${path.relative(rootDir, modelRankingPath)}`);
}

async function main() {
  await mkdir(dataDir, { recursive: true });

  if (allowInsecureTls) {
    console.warn('Warning: TLS certificate validation is disabled for this fetch run.');
  }

  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const fetchedItems = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  const failures = results
    .map((result, index) => ({ result, source: SOURCES[index] }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ result, source }) => ({
      source: source.name,
      message: [
        result.reason?.message || String(result.reason),
        result.reason?.cause?.code,
        result.reason?.cause?.message
      ]
        .filter(Boolean)
        .join(' - ')
    }));

  const previousItems = await readPreviousNews();
  const items = await translateNewsItems(rankItems([...fetchedItems, ...previousItems]));
  const payload = {
    updatedAt: new Date().toISOString(),
    count: items.length,
    sources: SOURCES.map(({ name, homepage, category }) => ({ name, homepage, category })),
    failures,
    items
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Saved ${items.length} AI news items to ${path.relative(rootDir, outputPath)}`);
  await refreshRankings();

  if (failures.length > 0) {
    console.warn('Fetch warnings:');
    for (const failure of failures) {
      console.warn(`- ${failure.source}: ${failure.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
