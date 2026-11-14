import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicatePosts, distributeFeed } from '../js/components/blog/useFeedDistribution.js';

function posts(count, options = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: options.idOffset ? index + options.idOffset : index + 1,
    title: `Notícia espacial ${index + 1}`,
    url: `https://news.example/story-${index + 1}`,
    image_url: options.withoutImages ? null : `https://images.example/${index + 1}.jpg`,
    published_at: new Date(Date.UTC(2026, 9, 20, 0, index)).toISOString(),
    topic: index % 2 ? 'mars' : 'launches',
    summary: index % 3 ? 'orbital update' : 'mars orbit',
  }));
}

function allAllocated(distribution) {
  return [
    distribution.heroLead,
    ...distribution.heroSides,
    ...distribution.related,
    ...distribution.media,
    ...distribution.topStories,
    distribution.topFeature,
    distribution.dailyFeature,
    ...distribution.storyTexts,
    ...distribution.storyCards,
    distribution.bannerFeature,
    ...distribution.bannerMedia,
    ...distribution.latest,
    ...distribution.archive,
  ].filter(Boolean);
}

test('a publication is allocated to at most one section', () => {
  const allocated = allAllocated(distributeFeed(posts(60)));
  const ids = allocated.map(post => post.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('duplicates are removed by normalized URL and title', () => {
  const input = [
    { id: 1, title: 'Europa Clipper chega a Marte!', url: 'https://news.example/story/?utm_source=x#top' },
    { id: 2, title: 'Outra manchete', url: 'https://news.example/story' },
    { id: 3, title: 'Europa Clipper chega a Marte', url: 'https://other.example/europa' },
    { id: 4, title: 'Matéria independente', url: 'https://other.example/unique' },
    { id: 5, title: 'História distinta', url: 'https://other.example/id-first' },
    { id: 5, title: 'Outro título e endereço', url: 'https://other.example/id-second' },
  ];
  assert.deepEqual(deduplicatePosts(input).map(post => post.id), [1, 4, 5]);
});

test('latest gets the newest unused stories and at least twelve from a pool of sixty', () => {
  const distribution = distributeFeed(posts(60));
  assert.equal(distribution.latest.length, 12);
  assert.equal(distribution.latest[0].id, 30);
  assert.equal(distribution.latest.at(-1).id, 19);
  assert.ok(distribution.latest.every((post, index, list) => (
    index === 0 || Date.parse(list[index - 1].published_at) >= Date.parse(post.published_at)
  )));
  assert.ok(distribution.archive.length > 0);
});

test('archive excludes latest and all editorial highlights', () => {
  const distribution = distributeFeed(posts(60));
  const reservedIds = new Set([
    distribution.heroLead,
    ...distribution.heroSides,
    ...distribution.related,
    ...distribution.media,
    ...distribution.topStories,
    distribution.topFeature,
    distribution.dailyFeature,
    ...distribution.storyTexts,
    ...distribution.storyCards,
    distribution.bannerFeature,
    ...distribution.bannerMedia,
    ...distribution.latest,
  ].filter(Boolean).map(post => post.id));
  assert.ok(distribution.archive.every(post => !reservedIds.has(post.id)));
});

test('small feeds never repeat items or fill sections with duplicates', () => {
  const distribution = distributeFeed(posts(8));
  const allocated = allAllocated(distribution);
  assert.equal(new Set(allocated.map(post => post.id)).size, allocated.length);
  assert.equal(distribution.heroSides.length, 2);
  assert.equal(distribution.related.length, 3);
  assert.equal(distribution.media.length, 2);
  assert.deepEqual(distribution.topStories, []);
  assert.equal(distribution.topFeature, null);
  assert.deepEqual(distribution.latest, []);
  assert.deepEqual(distribution.archive, []);
});

test('topic and search filtered feeds retain uniqueness', () => {
  const filtered = posts(60).filter(post => post.topic === 'mars' && post.summary.includes('mars'));
  const distribution = distributeFeed(filtered);
  const allocated = allAllocated(distribution);
  assert.equal(new Set(allocated.map(post => post.id)).size, allocated.length);
});

test('image-only sections do not receive posts without an image', () => {
  const distribution = distributeFeed(posts(40, { withoutImages: true }));
  assert.equal(distribution.heroLead, null);
  assert.deepEqual(distribution.heroSides, []);
  assert.equal(distribution.topFeature, null);
  assert.deepEqual(distribution.storyCards, []);
  assert.equal(distribution.bannerFeature, null);
  assert.deepEqual(distribution.bannerMedia, []);
});

test('a refreshed feed deterministically puts a new story first without repeating it', () => {
  const original = posts(60);
  const refreshed = {
    ...original[0],
    id: 61,
    title: 'Publicação recém-chegada',
    url: 'https://news.example/new-story',
    published_at: new Date(Date.UTC(2026, 9, 21)).toISOString(),
  };
  const first = distributeFeed(original);
  const updated = distributeFeed([refreshed, ...original]);
  assert.equal(first.heroLead.id, 60);
  assert.equal(updated.heroLead.id, 61);
  assert.deepEqual(distributeFeed([refreshed, ...original]), updated);
  const allocated = allAllocated(updated);
  assert.equal(allocated.filter(post => post.id === 61).length, 1);
});

test('a failed image is skipped for visual sections and remains available to text sections', () => {
  const input = posts(12);
  const brokenPost = input.at(-1);
  const brokenUrl = brokenPost.image_url;
  const distribution = distributeFeed(input, 12, new Set([brokenUrl]));
  assert.notEqual(distribution.heroLead?.id, brokenPost.id);
  assert.ok(distribution.related.some(post => post.id === brokenPost.id));
  const allocated = allAllocated(distribution);
  assert.equal(new Set(allocated.map(post => post.id)).size, allocated.length);
});

test('failed-image redistribution is deterministic', () => {
  const input = posts(30);
  const failed = new Set([input[0].image_url, input[3].image_url]);
  assert.deepEqual(distributeFeed(input, 12, failed), distributeFeed(input, 12, failed));
});
