import { normalizeImageUrl } from './useImageHealth.js';

function hasImage(post, failedImages = new Set()) {
  return [post?.image_url, post?.thumbnail, post?.image]
    .map(normalizeImageUrl)
    .some(url => url && !failedImages.has(url));
}

const normalizeTitle = title => String(title || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function normalizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${url.pathname}`;
  } catch {
    return String(value).split(/[?#]/, 1)[0].replace(/\/+$/, '').toLowerCase();
  }
}

function identityKeys(post) {
  const keys = [];
  const id = post?.id == null ? '' : String(post.id).trim();
  const url = normalizeUrl(post?.url);
  const title = normalizeTitle(post?.title);
  if (id && id !== '0') keys.push(`id:${id}`);
  if (url) keys.push(`url:${url}`);
  if (title) keys.push(`title:${title}`);
  return keys;
}

export function deduplicatePosts(posts) {
  const seen = new Set();
  const unique = [];
  for (const post of posts || []) {
    const keys = identityKeys(post);
    if (keys.some(key => seen.has(key))) continue;
    keys.forEach(key => seen.add(key));
    unique.push(post);
  }
  return unique;
}

function take(pool, count, predicate = () => true) {
  const selected = [];
  for (let index = 0; index < pool.length && selected.length < count;) {
    if (predicate(pool[index])) selected.push(...pool.splice(index, 1));
    else index += 1;
  }
  return selected;
}

function chronological(posts) {
  return posts
    .map((post, index) => ({ post, index, time: Date.parse(post.published_at) }))
    .sort((a, b) => {
      const timeDiff = (Number.isNaN(b.time) ? -Infinity : b.time)
        - (Number.isNaN(a.time) ? -Infinity : a.time);
      return timeDiff || a.index - b.index;
    })
    .map(item => item.post);
}

export function distributeFeed(posts, latestLimit = 12, failedImages = new Set()) {
  const pool = chronological(deduplicatePosts(posts));
  const imageAvailable = post => hasImage(post, failedImages);
  const hero = take(pool, 3, imageAvailable);
  const related = take(pool, 3);
  const media = take(pool, 5, imageAvailable);
  const topStories = take(pool, 4, imageAvailable);
  const topFeature = take(pool, 1, imageAvailable)[0] || null;
  const dailyFeature = take(pool, 1, imageAvailable)[0] || null;
  const storyTexts = take(pool, 3);
  const storyCards = take(pool, 5, imageAvailable);
  const bannerFeature = take(pool, 1, imageAvailable)[0] || null;
  const bannerMedia = take(pool, 4, imageAvailable);
  const latest = take(pool, Math.max(0, latestLimit));

  return {
    heroLead: hero[0] || null,
    heroSides: hero.slice(1),
    related,
    media,
    topStories,
    topFeature,
    dailyFeature,
    storyTexts,
    storyCards,
    bannerFeature,
    bannerMedia,
    latest,
    archive: pool,
  };
}
