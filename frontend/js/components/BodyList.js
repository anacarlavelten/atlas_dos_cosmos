/* Lista lateral de astros do nível atual, agrupada como no catálogo. */
import { computed } from 'vue';
import { store, engineRef, colorOf } from '../store.js';

export default {
  name: 'BodyList',
  setup() {
    const title = computed(() => store.levels.find(l => l.level === store.level)?.name || '');
    const groups = computed(() => {
      const out = new Map();
      const push = (group, item) => { if (!out.has(group)) out.set(group, []); out.get(group).push(item); };
      for (const b of store.bodies) {
        if (b.level !== store.level) continue;
        push(b.group, { id: b.slug, name: b.name, color: b.color || colorOf(b.category) });
        if (b.slug === 'neos' && store.neos) {
          for (const n of store.neos.objects) {
            if (!n.elements) continue;
            push(b.group, { id: `neo:${n.id}`, name: n.name, color: colorOf('neo'), note: `${n.miss_distance_lunar.toFixed(1)} DL` });
          }
        }
      }
      return [...out.entries()].map(([name, items]) => ({ name, items }));
    });
    const pick = id => { engineRef.current?.select(id); store.listOpen = false; };
    return { store, title, groups, pick };
  },
  template: `
  <aside class="panel" id="list" :class="{ open: store.listOpen }" aria-label="Lista de astros">
    <h3>{{ title }}</h3>
    <div class="lscroll">
      <template v-for="g in groups" :key="g.name">
        <div class="grp">{{ g.name }}</div>
        <button v-for="it in g.items" :key="it.id" class="it" :class="{ on: store.selectedId === it.id }"
                :style="{ '--c': it.color }" @click="pick(it.id)">
          <i></i>{{ it.name }}<small v-if="it.note" title="distâncias lunares">{{ it.note }}</small>
        </button>
      </template>
    </div>
  </aside>`,
};
