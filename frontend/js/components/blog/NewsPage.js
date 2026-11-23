import { ref } from 'vue';
import BlogHero from './BlogHero.js';
import BlogTimeline from './BlogTimeline.js';
import MediaStrip from './MediaStrip.js';
import { distributeFeed } from './useFeedDistribution.js';

export default {
  name: 'NewsPage',
  components: { BlogHero, BlogTimeline, MediaStrip },
  setup() {
    const distribution = ref(distributeFeed([]));
    const updateDistribution = value => { distribution.value = value; };
    return { distribution, updateDistribution };
  },
  template: `
  <div class="news-page">
    <MediaStrip :posts="distribution.media" />
    <BlogHero
      :lead="distribution.heroLead"
      :side-stories="distribution.heroSides"
      :related-stories="distribution.related"
    />
    <BlogTimeline @distribution-update="updateDistribution" />
  </div>`,
};
