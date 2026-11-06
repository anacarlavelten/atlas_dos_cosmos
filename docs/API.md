# API do Atlas do Cosmos

Todas as rotas respondem JSON e aceitam apenas `GET`. A documentação interativa (gerada
automaticamente pelo FastAPI a partir dos esquemas Pydantic) fica em
`http://127.0.0.1:8000/api/docs`, onde dá para testar cada rota pelo navegador.

Quando a NASA não responde e não há nada em cache, a rota devolve **503** (ou **429**
se a cota da chave acabou) com uma mensagem:

```json
{ "detail": "Não foi possível obter dados de NeoWs: serviço indisponível (HTTP 503).", "service": "NeoWs" }
```

Respostas que vêm do cache vencido (a NASA falhou, mas havia uma cópia guardada)
trazem `"stale": true`.

---

## Sistema

### `GET /api/health`
Estado do servidor e da chave da NASA (sem revelar a chave).

```json
{ "status": "ok", "app": "Atlas do Cosmos", "version": "2.0.0", "environment": "development",
  "nasa_key_configured": true, "using_demo_key": false,
  "nasa_rate_limit": { "limit": "1000", "remaining": "987" } }
```

---

## Catálogo (`atlas/catalog`)

### `GET /api/catalog/levels`
Os três níveis de escala: `Sistema Solar` (UA), `Via Láctea` (mil anos-luz) e
`Universo` (milhões de anos-luz).

### `GET /api/catalog/bodies?level=1`
Lista os astros (opcionalmente de um nível). Cada item:

```json
{
  "slug": "lua", "level": 1, "category": "moon", "group": "Luas",
  "name": "Lua", "kind": "Satélite natural da Terra",
  "summary": "A única lua da Terra e o único outro mundo onde seres humanos já pisaram...",
  "curiosity": "A Lua mostra sempre a mesma face para nós...",
  "color": null, "parent": "terra",
  "facts": [ { "label": "Diâmetro", "value": "3.474 km" } ],
  "render": { "radius_km": 1737.4, "texture": "moon", "rotation_hours": 655.68, "fallback": { "...": "..." } },
  "action": null, "live": [],
  "nasa": { "horizons": "301", "sbdb": null, "images": "Moon lunar surface" }
}
```

- `render`: parâmetros que o motor 3D usa para desenhar (raio, textura, coordenadas...).
- `live`: painéis com dados ao vivo no card (`flares`, `epic`, `neos`, `exoplanets`).
- `nasa`: identificadores do astro nas APIs da NASA.

### `GET /api/catalog/bodies/{slug}`
Um astro. `404` se não existir.

---

## Órbitas (`atlas/orbits`)

### `GET /api/orbits`
Elementos orbitais de todos os astros do nível 1 e posição das sondas.

```json
{
  "generated_at": "2026-10-26T22:10:03Z",
  "bodies": [
    { "slug": "marte", "center": "sol", "source": "JPL Horizons", "fetched_at": "2026-10-26T22:09:58Z",
      "elements": { "epoch_jd": 2461339.5, "a": 1.5236, "e": 0.0934, "i": 1.848,
                    "om": 49.49, "w": 286.64, "ma": 102.41, "n": 0.5240 } }
  ],
  "spacecraft": [
    { "slug": "voyager", "source": "JPL Horizons", "epoch_jd": 2461339.5,
      "position": [-31.2, -136.4, 101.8], "velocity": [-0.0007, -0.0084, 0.0063] }
  ],
  "warnings": []
}
```

| Campo | Significado |
|---|---|
| `a` | semieixo maior (UA) |
| `e` | excentricidade |
| `i` | inclinação em relação à eclíptica (°) |
| `om` | longitude do nó ascendente Ω (°) |
| `w` | argumento do periélio ω (°) |
| `ma` | anomalia média na época (°) |
| `n` | movimento médio (°/dia) |
| `epoch_jd` | data (juliana) em que os elementos valem |
| `source` | `JPL Horizons`, `JPL SBDB` ou `aproximado` (tabela offline) |

---

## Asteroides próximos (`atlas/neo`)

### `GET /api/neo/week`
Os asteroides que passam mais perto da Terra nos próximos 7 dias (`NEO_LIMIT`, padrão 10),
com a órbita de cada um.

```json
{
  "start": "2026-10-26", "end": "2026-11-01", "total_in_week": 87,
  "objects": [
    { "id": "3700000", "name": "2026 TK3", "hazardous": false,
      "diameter_min_m": 12.0, "diameter_max_m": 26.8,
      "approach_date": "2026-Oct-26 00:17", "approach_epoch_ms": 1793000000000,
      "miss_distance_km": 230640.0, "miss_distance_lunar": 0.6, "velocity_km_s": 5.2,
      "orbit_class": "APO", "jpl_url": "https://ssd.jpl.nasa.gov/...",
      "elements": { "epoch_jd": 2461000.5, "a": 1.264, "e": 0.288, "...": "..." } }
  ],
  "source": "NASA NeoWs", "fetched_at": "...", "stale": false
}
```

---

## Exoplanetas (`atlas/exoplanets`)

### `GET /api/exoplanets/hosts`
Estrelas com planetas confirmados, já em coordenadas galácticas.

```json
{
  "total_planets": 6000, "total_hosts": 4500,
  "nearest": [ { "name": "Proxima Cen", "distance_ly": 4.24, "planets": 2,
                 "planet_names": ["Proxima Cen b", "Proxima Cen d"], "l": 313.94, "b": -1.93 } ],
  "by_method": { "Transit": 4300, "Radial Velocity": 1100 },
  "hosts": [ [313.94, -1.93, 4.24, 2] ],
  "source": "NASA Exoplanet Archive", "fetched_at": "...", "stale": false
}
```

`hosts` usa formato compacto para economizar banda: `[l (°), b (°), distância (anos-luz), nº de planetas]`.

---

## Imagens (`atlas/media`)

### `GET /api/media/apod`
Foto astronômica do dia: `date`, `title`, `explanation` (em inglês, texto original),
`media_type` (`image` ou `video`), `url`, `hdurl`, `thumbnail_url`, `copyright`, `page_url`.

### `GET /api/media/epic`
Últimas fotos da Terra inteira pela câmera EPIC: `images[]` com `date`, `caption`,
`image_url` (PNG), `thumbnail_url` (JPG), `centroid_lat`, `centroid_lon`. As URLs apontam
para o arquivo público `epic.gsfc.nasa.gov` (sem a chave).

### `GET /api/media/images/{slug}?limit=4`
Fotos do astro na NASA Image and Video Library, usando o termo de busca do catálogo
(`nasa.images`). Cada imagem: `nasa_id`, `title`, `description`, `thumbnail`, `page_url`.

---

## Clima espacial (`atlas/spaceweather`)

### `GET /api/space-weather/flares?days=30`
Resumo das erupções solares do período (1 a 90 dias):

```json
{ "start": "2026-09-26", "end": "2026-10-26", "count": 4,
  "by_class": { "C": 1, "M": 2, "X": 1 },
  "strongest": { "class_type": "X1.2", "peak_time": "2026-10-11T03:05Z", "active_region": 14261, "...": "..." },
  "recent": [ { "class_type": "M5.6", "peak_time": "2026-10-22T08:22Z", "...": "..." } ],
  "source": "NASA DONKI", "fetched_at": "...", "stale": false }
```

---

## Blog (`atlas/blog`)

A aba **Blog** (página inicial do frontend) usa só estas rotas e as de imagens, asteroides
e clima espacial acima. Nenhum conteúdo fica fixo no frontend; o backend consulta APIs
abertas (sem chave) e guarda as respostas no cache.

| Fonte | Uso | Cache |
|---|---|---|
| [Spaceflight News API](https://spaceflightnewsapi.net) | notícias, blogs e relatórios | `NEWS_TTL_MINUTES` (15) |
| [Launch Library 2](https://thespacedevs.com/llapi) | próximos lançamentos | `LAUNCHES_TTL_MINUTES` (60) |
| [NASA Technology Transfer](https://technology.nasa.gov) | tecnologias da NASA | `TECH_TTL_HOURS` (24) |

### `GET /api/blog/topics`
Filtros disponíveis: `kinds` (`articles`, `blogs`, `reports`), `topics` (`tudo`,
`tecnologia`, `lancamentos`, `lua-marte`, `astronomia`, `astronautas`) e `tech_areas`.
Cada tópico é traduzido em palavras buscadas no título das publicações.

### `GET /api/blog/feed?kind=articles&topic=tudo&q=&offset=0&limit=20`
Linha do tempo, da publicação mais nova para a mais antiga. `q` é uma busca livre
(até 80 caracteres). `404` para `kind`/`topic` desconhecidos.

```json
{ "kind": "articles", "topic": "tudo", "query": null, "total": 36799,
  "offset": 0, "limit": 20, "has_more": true,
  "posts": [ { "id": 40748, "kind": "articles", "title": "...", "summary": "...",
               "url": "https://spacenews.com/...", "image_url": "https://...",
               "news_site": "SpaceNews", "authors": ["SpaceNews Editor"],
               "published_at": "2026-11-05T14:15:38Z", "featured": false,
               "launches": 0, "events": 0 } ],
  "source": "Spaceflight News API", "fetched_at": "...", "stale": false }
```

### `GET /api/blog/launches?limit=6`
Próximos lançamentos: `name`, `net` (data prevista, UTC), `net_precision`, `status`,
`status_abbrev` (`Go`, `TBC`, `TBD`...), `provider`, `rocket`, `mission`, `orbit`, `pad`,
`location`, `image_url` e `page_url` (página no Space Launch Now).

### `GET /api/blog/technologies/{area}?limit=4`
Patentes da NASA disponíveis para licenciamento numa área (`propulsao`, `robotica`,
`materiais`, `sensores`, `energia`, `saude`): `title`, `summary`, `category`, `center`
(centro da NASA), `image_url`, `page_url`.
