import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const outputPath = path.join(dataDir, 'news.json');
const execFileAsync = promisify(execFile);

const MAX_ITEMS = 10;
const allowInsecureTls =
  process.argv.includes('--insecure-tls') || process.env.AI_NEWS_INSECURE_TLS === '1';

if (allowInsecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const SOURCES = [
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/news/rss.xml',
    homepage: 'https://openai.com/news/'
  },
  {
    name: 'Google DeepMind',
    url: 'https://deepmind.google/discover/blog/rss.xml',
    homepage: 'https://deepmind.google/discover/blog/'
  },
  {
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/news/rss.xml',
    homepage: 'https://www.anthropic.com/news'
  },
  {
    name: 'Microsoft AI Blog',
    url: 'https://blogs.microsoft.com/ai/feed/',
    homepage: 'https://blogs.microsoft.com/ai/'
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed/',
    homepage: 'https://venturebeat.com/category/ai/'
  },
  {
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
    homepage: 'https://www.technologyreview.com/topic/artificial-intelligence/'
  },
  {
    name: 'arXiv cs.AI',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    homepage: 'https://arxiv.org/list/cs.AI/recent'
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

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function getAtomLink(block) {
  const link = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return link ? decodeHtml(link[1]) : '';
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
        summary: summary.slice(0, 240),
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null
      };
    })
    .filter((item) => item.title && item.link);
}

async function fetchSource(source) {
  let xml;

  try {
    const response = await fetch(source.url, {
      headers: {
        'user-agent': 'ai-news-daily/1.0 (+local project)'
      }
    });

    if (!response.ok) {
      throw new Error(`${source.name} returned HTTP ${response.status}`);
    }

    xml = await response.text();
  } catch (error) {
    if (process.platform !== 'win32') {
      throw error;
    }

    xml = await fetchWithPowerShell(source.url, error);
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
        '& { param($url) $ProgressPreference = "SilentlyContinue"; (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30).Content }',
        url
      ],
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
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

  return items
    .filter((item) => {
      const key = item.link || `${item.source}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => parseDate(b.publishedAt) - parseDate(a.publishedAt))
    .slice(0, MAX_ITEMS);
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
  const items = rankItems([...fetchedItems, ...previousItems]);
  const payload = {
    updatedAt: new Date().toISOString(),
    count: items.length,
    sources: SOURCES.map(({ name, homepage }) => ({ name, homepage })),
    failures,
    items
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Saved ${items.length} AI news items to ${path.relative(rootDir, outputPath)}`);

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
