const list = document.querySelector('#newsList');
const emptyState = document.querySelector('#emptyState');
const updatedAt = document.querySelector('#updatedAt');
const count = document.querySelector('#count');
const sources = document.querySelector('#sources');
const refreshButton = document.querySelector('#refreshButton');
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');
const gpuRankings = document.querySelector('#gpuRankings');
const gpuGuidance = document.querySelector('#gpuGuidance');
const gpuUpdatedAt = document.querySelector('#gpuUpdatedAt');

const formatter = new Intl.NumberFormat('zh-CN');

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

function activateTab(targetId) {
  for (const button of tabButtons) {
    const isActive = button.dataset.tabTarget === targetId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  }

  for (const panel of tabPanels) {
    panel.classList.toggle('active', panel.id === targetId);
  }
}

function renderGpuRankings(rankings) {
  gpuRankings.replaceChildren();

  for (const group of rankings) {
    const section = document.createElement('section');
    section.className = 'ranking-section';

    const title = document.createElement('div');
    title.className = 'ranking-title';

    const heading = document.createElement('h3');
    heading.textContent = group.title;

    const description = document.createElement('span');
    description.textContent = group.description;

    title.append(heading, description);

    const list = document.createElement('ol');
    list.className = 'gpu-list';

    for (const item of group.items) {
      const row = document.createElement('li');
      row.className = 'gpu-row';

      const meta = document.createElement('div');
      meta.className = 'gpu-meta';

      const name = document.createElement('strong');
      name.textContent = `${item.rank}. ${item.name}`;

      const role = document.createElement('span');
      role.textContent = item.bestFor;

      meta.append(name, role);

      const specs = document.createElement('dl');
      specs.className = 'specs';
      for (const spec of item.specs) {
        const term = document.createElement('dt');
        term.textContent = spec.label;
        const detail = document.createElement('dd');
        detail.textContent = spec.value;
        specs.append(term, detail);
      }

      const reason = document.createElement('p');
      reason.className = 'gpu-reason';
      reason.textContent = item.reason;

      row.append(meta, specs, reason);
      list.append(row);
    }

    section.append(title, list);
    gpuRankings.append(section);
  }
}

function renderGuidance(guidance) {
  gpuGuidance.replaceChildren();

  for (const item of guidance) {
    const card = document.createElement('article');
    card.className = 'guidance-card';

    const title = document.createElement('h3');
    title.textContent = item.title;

    const text = document.createElement('p');
    text.textContent = item.text;

    const chips = document.createElement('div');
    chips.className = 'chip-row';
    for (const choice of item.choices) {
      const chip = document.createElement('span');
      chip.textContent = choice;
      chips.append(chip);
    }

    card.append(title, text, chips);
    gpuGuidance.append(card);
  }
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

async function loadGpuRanking() {
  try {
    const response = await fetch('./data/gpu-ranking.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('gpu-ranking.json not found');

    const data = await response.json();
    gpuUpdatedAt.textContent = `更新：${data.updatedAt} · ${formatter.format(data.itemsCount)} 款 GPU`;
    renderGpuRankings(data.rankings || []);
    renderGuidance(data.guidance || []);
  } catch {
    gpuUpdatedAt.textContent = '排名数据暂不可用';
    renderGpuRankings([]);
    renderGuidance([]);
  }
}

refreshButton.addEventListener('click', () => {
  window.location.reload();
});

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    activateTab(button.dataset.tabTarget);
  });
}

loadNews();
loadGpuRanking();
