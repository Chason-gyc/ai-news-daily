const list = document.querySelector('#newsList');
const emptyState = document.querySelector('#emptyState');
const updatedAt = document.querySelector('#updatedAt');
const count = document.querySelector('#count');
const sources = document.querySelector('#sources');
const refreshButton = document.querySelector('#refreshButton');

function formatDate(value) {
  if (!value) return '未知时间';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function renderNews(items) {
  list.replaceChildren();
  count.textContent = `${items.length} / 10`;
  emptyState.hidden = items.length > 0;

  for (const item of items) {
    const card = document.createElement('li');
    card.className = 'news-card';

    const title = document.createElement('a');
    title.href = item.link;
    title.target = '_blank';
    title.rel = 'noreferrer';
    title.textContent = item.title;

    const byline = document.createElement('div');
    byline.className = 'byline';
    byline.textContent = `${item.source} · ${formatDate(item.publishedAt)}`;

    const summary = document.createElement('p');
    summary.className = 'summary';
    summary.textContent = item.summary || '暂无摘要。';

    card.append(title, byline, summary);
    list.append(card);
  }
}

function renderSources(items) {
  const wrapper = document.createElement('div');
  wrapper.className = 'source-grid';

  for (const source of items) {
    const link = document.createElement('a');
    link.href = source.homepage;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = source.name;
    wrapper.append(link);
  }

  sources.replaceChildren(wrapper);
}

async function loadNews() {
  try {
    const response = await fetch('./data/news.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('news.json not found');

    const data = await response.json();
    updatedAt.textContent = `更新时间：${formatDate(data.updatedAt)}`;
    renderNews(data.items || []);
    renderSources(data.sources || []);
  } catch {
    updatedAt.textContent = '尚未生成数据';
    renderNews([]);
    renderSources([]);
  }
}

refreshButton.addEventListener('click', () => {
  window.location.reload();
});

loadNews();
