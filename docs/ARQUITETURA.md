# Atlas do Cosmos — Arquitetura e funcionamento

Este documento explica como o projeto está organizado, por que foi organizado assim e
o que faz cada parte. Ele segue a sequência das apostilas da disciplina (Unidades 1 a 6),
trocando o Flask pelo FastAPI.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Por que FastAPI (e o que mudou em relação ao Flask)](#2-por-que-fastapi-e-o-que-mudou-em-relação-ao-flask)
3. [Estrutura de pastas](#3-estrutura-de-pastas)
4. [Application Factory e ciclo de vida](#4-application-factory-e-ciclo-de-vida)
5. [Extensões (`atlas/ext`)](#5-extensões-atlasext)
6. [Domínios](#6-domínios)
7. [Banco de dados](#7-banco-de-dados)
8. [O caminho de uma requisição](#8-o-caminho-de-uma-requisição)
9. [Segurança da chave da NASA](#9-segurança-da-chave-da-nasa)
10. [Frontend](#10-frontend)
11. [Testes](#11-testes)
12. [Como estender o projeto](#12-como-estender-o-projeto)
13. [Problemas comuns](#13-problemas-comuns)

---

## 1. Visão geral

O Atlas tem duas partes separadas, como o TaskFlow das apostilas:

- **Backend (Python/FastAPI):** guarda o catálogo de astros, conversa com as APIs da NASA,
  guarda as respostas em cache e expõe tudo numa **API HTTP/REST** (`/api/...`).
- **Frontend (Vue 3 + Three.js):** desenha o cosmos em 3D e mostra os painéis. Ele **só
  conversa com o backend**, nunca com a NASA diretamente.

```mermaid
flowchart LR
    U[Navegador<br/>Vue 3 + Three.js] -- "GET /api/..." --> B[Backend FastAPI<br/>atlas/]
    B -- SQL --> DB[(SQLite<br/>instance/atlas.db)]
    B -- "HTTPS (com chave)" --> K[api.nasa.gov<br/>APOD · NeoWs · DONKI · EPIC]
    B -- "HTTPS (sem chave)" --> J[JPL Horizons · SBDB<br/>Image Library · Exoplanet Archive]
```

Por que passar tudo pelo backend?

1. **A chave fica escondida.** Se o navegador chamasse a NASA, a chave apareceria no código
   da página para qualquer pessoa.
2. **Cache.** A chave pessoal permite ~1.000 requisições por hora. Com o cache, 100 alunos
   abrindo o site ao mesmo tempo geram praticamente as mesmas poucas consultas à NASA.
3. **Tratamento dos dados.** O backend converte formatos difíceis (o texto CSV do Horizons,
   a ascensão reta/declinação do Exoplanet Archive) em JSON simples para o frontend.
4. **Resiliência.** Se a NASA cair, o backend devolve a última resposta guardada ou a tabela
   aproximada do JPL, e o site continua funcionando.

## 2. Por que FastAPI (e o que mudou em relação ao Flask)

O FastAPI é um framework mais recente que segue o padrão **ASGI** (a versão assíncrona do
WSGI da PEP 3333). As vantagens para este projeto:

- **Assíncrono (`async`/`await`):** enquanto o servidor espera a resposta do JPL, ele atende
  outras requisições. Com o Flask (síncrono), cada consulta à NASA bloquearia um processo.
  O Atlas faz dezenas de consultas em paralelo ao montar as órbitas.
- **Validação e documentação automáticas:** os esquemas Pydantic (`schemas.py`) validam as
  respostas e geram a página `/api/docs` sem nenhum código extra.
- **Desempenho:** roda sobre o Uvicorn (servidor ASGI baseado em `uvloop`/`httptools`).

Os conceitos das apostilas continuam todos lá, com outro nome:

| Apostila (Flask) | Neste projeto (FastAPI) | Onde |
|---|---|---|
| `create_app()` (Application Factory) | `create_app()` | `atlas/__init__.py` |
| `ext.init_app(app)` | `init_app(app)` em cada extensão e domínio | `atlas/ext/*`, `atlas/<domínio>/__init__.py` |
| Blueprint | `APIRouter` | `atlas/<domínio>/routes.py` |
| `app.config.from_object(Config)` | `Settings` (pydantic-settings) lido do `.env` | `atlas/ext/config` |
| `current_app.config` | `request.app.state.settings` (dependência `settings_from`) | `atlas/ext/config` |
| Flask-SQLAlchemy `db.session` | `AsyncSession` injetada por dependência (`SessionDep`) | `atlas/ext/db` |
| `db.Model` + `Mapped`/`mapped_column` | `Base` + `Mapped`/`mapped_column` (SQLAlchemy 2.x) | `models.py` |
| `register_models()` com import tardio | igual | `atlas/ext/db` |
| `with app.app_context():` | `async with app_context(app):` | `atlas/ext/lifecycle.py` |
| `flask shell` | `atlas shell` | `atlas/ext/cli` |
| Comandos `flask ...` (Click) | Comandos `atlas ...` (Typer, feito sobre o Click) | `atlas/ext/cli` |
| WSGI + Gunicorn | ASGI + Uvicorn | `app.py` |
| `pytest-flask` (`client`) | `TestClient` do FastAPI | `tests/conftest.py` |
| `.env.dev` / `python-dotenv` | `.env` lido pelo pydantic-settings | `.env.example` |
| Black + Flake8 | Ruff (faz os dois, bem mais rápido) | `pyproject.toml` |

## 3. Estrutura de pastas

```
atlas-cosmos/
├── app.py                  # entry point: app = create_app()  (uvicorn app:app)
├── pyproject.toml          # pacote instalável, dependências, config do pytest e do ruff
├── tasks.py                # automação com Invoke (run, test, lint, format...)
├── .env.example            # modelo de configuração → copie para .env (chave da NASA)
├── atlas/                  # pacote Python do backend
│   ├── __init__.py         # create_app(): a Application Factory
│   ├── ext/                # extensões de infraestrutura (cada uma com init_app)
│   │   ├── config/         # Settings: variáveis de ambiente e .env
│   │   ├── db/             # SQLAlchemy assíncrono: Base, engine, sessões
│   │   ├── cache/          # cache persistente das respostas da NASA (+ modelo CacheEntry)
│   │   ├── nasa/           # um cliente por API da NASA + o NasaGateway
│   │   ├── web/            # CORS, GZip, erros, /api/health, frontend estático
│   │   ├── cli/            # comandos `atlas ...`
│   │   └── lifecycle.py    # hooks de startup/shutdown, lifespan e app_context
│   ├── catalog/            # domínio: astros e textos didáticos (+ data/catalog.json)
│   ├── orbits/             # domínio: elementos orbitais (JPL) e sondas
│   ├── neo/                # domínio: asteroides próximos da Terra (NeoWs)
│   ├── exoplanets/         # domínio: estrelas com exoplanetas (Exoplanet Archive)
│   ├── media/              # domínio: APOD, EPIC e NASA Image Library
│   └── spaceweather/       # domínio: erupções solares (DONKI)
├── frontend/               # aplicação Vue 3 + Three.js (sem build)
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── main.js         # cria o app Vue, carrega os dados e o motor 3D
│   │   ├── api.js          # cliente da API do backend
│   │   ├── store.js        # estado reativo compartilhado
│   │   ├── config.js       # endereço da API
│   │   ├── components/     # componentes Vue (barra, lista, card, controles, janelas)
│   │   └── engine/         # motor 3D (Three.js)
│   └── vendor/             # Vue e Three.js baixados (funcionam sem CDN)
├── tests/                  # PyTest + NASA simulada (nasa_mock.py e fixtures/)
├── docs/                   # esta documentação
└── instance/               # criado na 1ª execução: banco SQLite (fora do Git)
```

Cada domínio segue o mesmo formato da Unidade 6:

| Arquivo | Papel |
|---|---|
| `__init__.py` | `init_app(app)`: registra o `APIRouter` e, se precisar, hooks de startup |
| `models.py` | classes ORM (tabelas). Só existe quando o domínio tem tabela própria |
| `schemas.py` | formato JSON das respostas (Pydantic) — aparece no `/api/docs` |
| `services.py` | **regras de negócio**: consulta o banco, chama a NASA, monta o resultado |
| `routes.py` | rotas HTTP finas: recebem a requisição e chamam o service |

As rotas não têm lógica: isso permite testar e reutilizar os services fora do HTTP (a CLI
`atlas refresh`, por exemplo, chama `orbits.services.get_orbits` diretamente).

## 4. Application Factory e ciclo de vida

`atlas/__init__.py`:

```python
def create_app(settings=None, *, nasa_transport=None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(..., lifespan=lifespan)
    prepare_hooks(app)

    config.init_app(app, settings)   # app.state.settings
    db.init_app(app)                 # app.state.db  (+ hook: criar tabelas)
    cache.init_app(app)
    nasa.init_app(app, transport=nasa_transport)   # hook: criar o cliente HTTP
    web.init_app(app)                # middlewares, erros, /api/health

    for domain in DOMAINS:           # catalog, orbits, neo, exoplanets, media, spaceweather
        domain.init_app(app)         # app.include_router(router) + hooks

    web.mount_frontend(app)          # por último, para não "engolir" as rotas /api
    return app
```

- **Nenhum objeto global `app`.** O `app.py` é o único lugar que chama `create_app()`.
  Os testes criam uma aplicação nova por teste, com banco temporário e a NASA simulada
  (`nasa_transport`). É exatamente o argumento da Unidade 4: a factory evita importações
  circulares e torna o projeto testável.
- **Inversão de controle:** as extensões e domínios não importam o `app`; recebem-no em
  `init_app` e se registram nele.

### Fases (equivalentes às da Unidade 4)

| Fase | Quando | O que acontece aqui |
|---|---|---|
| Configuração | `create_app()` | `init_app` de tudo; rotas e middlewares registrados |
| Startup (contexto da aplicação) | servidor sobe → `lifespan` | hooks em ordem: cria tabelas → cria o cliente da NASA → carrega o catálogo (se vazio) → busca as órbitas em segundo plano |
| Requisição | cada `GET /api/...` | dependências criam a sessão do banco e entregam `settings` e `nasa` à rota |
| Shutdown | servidor para | hooks na ordem inversa: cancela tarefas, fecha o cliente HTTP, fecha o banco |

`atlas/ext/lifecycle.py` guarda essa lógica. O `lifespan` do FastAPI e o `app_context`
(usado pela CLI) executam os mesmos hooks, o que dá o mesmo papel do
`with app.app_context():`.

### Dependências (o lugar do `current_app`, `g` e `request`)

Em vez de proxies globais, o FastAPI **injeta** o que cada rota precisa:

```python
@router.get("/week")
async def week(session: SessionDep, nasa: NasaDep, settings: Settings = Depends(settings_from)):
    return await services.get_week(session, nasa, settings)
```

- `SessionDep` → abre uma `AsyncSession` só para essa requisição e a fecha no fim
  (`ext/db.get_session`);
- `NasaDep` → o `NasaGateway` da aplicação (`ext/nasa.get_nasa`);
- `settings_from` → a configuração da aplicação que atende a requisição.

## 5. Extensões (`atlas/ext`)

### `config` — configuração
`Settings` (pydantic-settings) lê variáveis de ambiente e o `.env` da raiz. Cada atributo
pode ser sobrescrito por uma variável com o mesmo nome em maiúsculas (`NASA_API_KEY`,
`DATABASE_URL`, `NEO_LIMIT`...). Os tipos são validados: `NEO_LIMIT=abc` impede o servidor
de subir com uma mensagem clara. Os principais parâmetros estão comentados no `.env.example`.

### `db` — banco de dados
- `Base`: classe base dos modelos (SQLAlchemy 2.x, estilo `Mapped[...]`, como na Unidade 6).
- `Database`: cria o `AsyncEngine` (driver `aiosqlite`) e a fábrica de sessões; liga o
  `PRAGMA foreign_keys=ON` do SQLite para que `ON DELETE CASCADE` funcione.
- `register_models()`: importa os módulos de modelos **dentro da função** (import tardio),
  para registrar as tabelas sem criar import circular.
- Para usar outro banco basta trocar `DATABASE_URL`. Os modelos não mudam. O PostgreSQL
  (ex.: Supabase) já vem pronto com o driver `asyncpg`: a URL pode ser colada como o painel
  mostra (`postgresql://...?sslmode=require`), e `Settings` troca o prefixo para
  `postgresql+asyncpg://`. Na porta **6543** (pooler do Supabase em modo *transaction*) o
  cache de *prepared statements* do asyncpg é desligado, porque o pooler não o suporta.
  `Database.safe_url` mostra a URL com a senha escondida.
- Este projeto usa `create_all()`, suficiente para um catálogo que é recarregado a partir
  do JSON. Se o esquema começar a evoluir com dados que não podem ser perdidos, o próximo
  passo é o **Alembic** (migrações), como a Unidade 6 recomenda.

### `cache` — respostas da NASA guardadas no banco
Tabela `cache_entries` (`key`, `payload` JSON, `source`, `fetched_at`, `expires_at`) e a
função `remember(session, key, ttl, producer)`:

```mermaid
flowchart TD
    A[remember] --> B{entrada válida no banco?}
    B -- sim --> R1[devolve do cache]
    B -- não --> C[producer chama a NASA]
    C -- ok --> D[salva com validade TTL] --> R2[devolve dado novo]
    C -- falhou --> E{existe entrada vencida?}
    E -- sim --> R3["devolve a antiga com stale=true"]
    E -- não --> R4[erro → HTTP 503]
```

Uma trava (`lock_for`) impede que duas requisições simultâneas busquem a mesma coisa na
NASA ao mesmo tempo. Os tempos de vida ficam no `.env` (`ORBITS_TTL_HOURS`, `NEO_TTL_MINUTES`...).

### `nasa` — clientes das APIs
`NasaGateway` reúne um cliente por serviço, todos compartilhando um único
`httpx.AsyncClient` (reaproveita conexões):

| Arquivo | Serviço | Chave | Usado por |
|---|---|---|---|
| `apod.py` | APOD | sim | `media` |
| `neows.py` | NeoWs (feed + lookup) | sim | `neo` |
| `donki.py` | DONKI (erupções, FLR) | sim | `spaceweather` |
| `epic.py` | EPIC | sim | `media` |
| `horizons.py` | JPL Horizons (ELEMENTS e VECTORS) | não | `orbits` |
| `sbdb.py` | JPL Small-Body Database | não | `orbits` |
| `images.py` | NASA Image and Video Library | não | `media` |
| `exoplanet_archive.py` | Exoplanet Archive (TAP/ADQL) | não | `exoplanets` |

`http.py` tem a base comum: limite de requisições simultâneas por serviço (semáforo),
uma nova tentativa em falhas temporárias (timeout, HTTP 5xx), `NasaRateLimited` para HTTP 429
e `NasaError` para o resto. Os módulos também têm **funções puras de interpretação**
(`parse_csv_table`, `parse_sbdb_elements`, `parse_image_items`), testadas isoladamente.

Detalhes que valem explicar na apresentação:
- O **Horizons** devolve um texto; as linhas de dados ficam entre `$$SOE` e `$$EOE`, e o
  cabeçalho CSV vem logo antes. O parser lê as colunas **pelo nome** (`EC`, `IN`, `OM`,
  `W`, `MA`, `N`, `A`), não pela posição.
- O **SBDB** às vezes omite `a` e `ma` (quando a época não é a padrão, como no cometa
  Halley). Eles são calculados: `a = q / (1 − e)` e `M = n · (época − tp)`.

### `web` — camada HTTP comum
CORS (para rodar o frontend em outra porta), GZip (a lista de exoplanetas é grande),
conversão de `NasaError` em 503/429, a rota `/api/health` e a montagem da pasta
`frontend/` na raiz `/`.

### `cli` — comandos de terminal
`atlas init-db`, `seed`, `refresh`, `check-nasa` e `shell` (ver o README). Feitos com
Typer e executados dentro de `app_context`.

## 6. Domínios

### `catalog` — astros e textos
- **Modelos:** `Body` (astro) e `BodyFact` (linhas da tabela do card, 1:N com
  `cascade="all, delete-orphan"`). `Body` tem um **relacionamento consigo mesmo**
  (`parent`/`children`), usado para lua → planeta, e um 1:1 com `OrbitalElements`.
- **Seed:** `data/catalog.json` tem os 71 astros (textos em português, parâmetros de
  desenho e identificadores nas APIs da NASA). Na primeira execução o hook
  `seed_if_empty` grava tudo no banco. Para editar um texto: altere o JSON e rode
  `atlas seed --replace`.
- **Rotas:** `/api/catalog/levels`, `/api/catalog/bodies`, `/api/catalog/bodies/{slug}`.

### `orbits` — onde está cada astro
- **Modelo:** `OrbitalElements` (a, e, i, Ω, ω, M, n e a época), um por astro.
- **Service `get_orbits`:** pega os astros do nível 1 que orbitam algo; os que não têm
  elementos ou estão vencidos (`ORBITS_TTL_HOURS`) são consultados **em paralelo**
  (`asyncio.gather`): SBDB para Ceres e Halley e Horizons para o resto. As luas usam
  `CENTER = 500@<planeta>`, ou seja, a órbita é relativa ao planeta.
- **Sondas:** Voyager 1 (`-31`), Voyager 2 (`-32`) e New Horizons (`-98`) recebem posição
  e velocidade do Horizons (`VECTORS`). O frontend extrapola em linha reta, o que é correto
  para elas (já escaparam do Sol).
- **Fallback:** `fallback.py` tem a tabela oficial do JPL de elementos aproximados dos
  planetas (válida de 1800 a 2050) e órbitas circulares simples para as luas. Ela só é usada
  se o JPL nunca respondeu, e o resultado vem marcado `source: "aproximado"`.
- **Startup:** um hook dispara `get_orbits` em segundo plano assim que o servidor sobe
  (`PREFETCH_ON_STARTUP`), para o primeiro visitante não esperar.

### `neo` — asteroides próximos da Terra
`feed` do NeoWs (até 7 dias) → escolhe os `NEO_LIMIT` que passam mais perto → um `lookup`
para cada um (em paralelo) para obter a órbita. Tudo vai para o cache como uma única
entrada (`neo:week:<data>`).

### `exoplanets` — estrelas com planetas
Consulta ADQL na tabela `pscomppars`, agrupa os planetas por estrela, converte
RA/Dec → coordenadas galácticas (`astro.py`, matriz de rotação da IAU) e parsecs →
anos-luz. Entrega a lista completa em formato compacto e as estrelas mais próximas.

### `media` — imagens
APOD (cache por dia), EPIC (as URLs das imagens apontam para o arquivo público, sem chave)
e a Biblioteca de Imagens, buscando pelo termo `image_query` de cada astro do catálogo.
Este é o único domínio que usa outro domínio: `get_body` do `catalog`.

### `spaceweather` — clima espacial
Erupções solares do DONKI: conta por classe (A, B, C, M, X), encontra a mais forte
(`flare_strength` converte "M2.5" em número comparável) e lista as recentes.

## 7. Banco de dados

```mermaid
erDiagram
    bodies ||--o{ body_facts : "tem (cascade)"
    bodies ||--o| orbital_elements : "tem (cascade)"
    bodies |o--o{ bodies : "parent / children"
    bodies {
        int id PK
        string slug UK
        int level
        string category
        string list_group
        string name
        string kind
        text summary
        text curiosity
        int parent_id FK
        string horizons_id
        string sbdb_id
        string image_query
        json render
        json action
        json live
    }
    body_facts {
        int id PK
        int body_id FK
        int position
        string label
        string value
    }
    orbital_elements {
        int id PK
        int body_id FK,UK
        string source
        string center
        float epoch_jd
        float a
        float e
        float i
        float om
        float w
        float ma
        float n
        datetime fetched_at
    }
    cache_entries {
        string key PK
        json payload
        string source
        datetime fetched_at
        datetime expires_at
    }
```

- `UNIQUE(body_id, position)` em `body_facts` garante a ordem das linhas do card.
- `orbital_elements.body_id` é `UNIQUE`: no máximo uma órbita por astro (1:1).
- `render`, `action` e `live` são JSON porque cada categoria de astro precisa de parâmetros
  diferentes (um planeta tem raio e textura; uma galáxia tem `l`, `b`, distância e sprite).

Para explorar o banco:

```text
$ atlas shell
>>> run(session.scalars(select(Body).where(Body.level == 1))).all()
>>> lua = run(session.scalar(select(Body).where(Body.slug == "lua")))
>>> run(session.refresh(lua, ["parent", "facts"])); lua.parent, lua.facts[0]
```

## 8. O caminho de uma requisição

Exemplo: o frontend pede `GET /api/neo/week`.

1. O **Uvicorn** recebe a conexão e entrega a requisição à aplicação ASGI.
2. Os **middlewares** (CORS, GZip) processam a entrada.
3. O roteador encontra `neo.routes.week`.
4. O FastAPI resolve as **dependências**: abre uma `AsyncSession`, pega o `NasaGateway` e as
   `Settings`.
5. A rota chama `neo.services.get_week(...)`.
6. O service chama `cache.remember("neo:week:2026-10-26:10", ...)`:
   - se houver resposta válida no banco, ela volta direto (sem tocar na NASA);
   - senão, `NeoWsClient.feed()` → escolhe os 10 mais próximos → 10 × `lookup()` em
     paralelo → monta o resultado → salva no banco.
7. O resultado é validado pelo esquema `NeoWeekOut` e serializado em JSON.
8. A sessão é fechada (fim da dependência) e a resposta volta comprimida.
9. Se a NASA falhar sem cache, a exceção `NasaError` vira **HTTP 503** no handler do `ext/web`.

## 9. Segurança da chave da NASA

- A chave só existe no `.env` do servidor e em `Settings.nasa_api_key`.
- Ela entra **apenas** na query string das chamadas do backend ao `api.nasa.gov`
  (`KeyedClient.keyed()`).
- Nenhuma resposta da API inclui a chave (há um teste para isso: `test_api_key_is_never_exposed`).
- As imagens do EPIC usam o arquivo público `epic.gsfc.nasa.gov`, então a URL entregue ao
  navegador não carrega a chave.
- O log do `httpx` (que imprimiria URLs com a chave) é rebaixado para `WARNING`.
- As mensagens de erro citam o serviço e o código HTTP, nunca a URL.
- `.env` está no `.gitignore`.

## 10. Frontend

### Por que Vue 3 sem build
A Unidade 6 prevê um frontend em Vue 3 separado do backend. Aqui o Vue é carregado como
**módulo ES** direto do navegador (`vendor/vue.esm-browser.prod.js`), com um *import map* no
`index.html`. Não há `npm install` nem etapa de build: os arquivos rodam como estão.
O Three.js também fica em `vendor/`, então o site não depende de CDN.

### Fluxo de inicialização (`js/main.js`)
1. Busca `health`, `levels` e `bodies` no backend.
2. Busca em paralelo `orbits`, `neo/week` e `exoplanets/hosts`. Se algum falhar, o erro é
   anotado em `store.errors` e o resto continua.
3. Cria o motor 3D com esses dados (`createEngine`).
4. Liga os eventos do motor ao estado reativo (`store`): astro selecionado, troca de nível,
   texto do HUD, play/pause.

### Componentes Vue (`js/components/`)

| Componente | O que mostra |
|---|---|
| `TopBar` | abas dos 3 níveis, botões "Dados da NASA", "Foto do dia", "Lista" e ajuda |
| `SourcesPanel` | de onde veio cada dado (ao vivo, cache, aproximado, erro) e o aviso de DEMO_KEY |
| `BodyList` | lista lateral agrupada (inclui os asteroides da semana) |
| `BodyCard` | card do astro: resumo, tabela, curiosidade, ação e os painéis ao vivo |
| `LiveWidgets` | `ImageStrip` (fotos), `FlaresWidget` (Sol), `EpicWidget` (Terra), `NeosWidget`, `ExoWidget` |
| `ControlBar` | tempo, inverter, hoje, tamanho dos astros e camadas (órbitas, asteroides, exoplanetas, nomes) |
| `Modals` | introdução e foto astronômica do dia |

Cada painel ao vivo só busca seus dados quando aparece (ex.: as erupções solares só são
consultadas quando alguém abre o card do Sol). `api.once()` evita repetir a mesma consulta.

### Motor 3D (`js/engine/`)

| Módulo | Responsabilidade |
|---|---|
| `setup.js` | configuração global do Three.js (cores sem conversão sRGB) |
| `util.js` | constantes, matemática, gerador aleatório com semente, cores por categoria |
| `textures.js` | texturas procedurais dos planetas, brilho e sprites de galáxias |
| `orbits.js` | **mecânica orbital**: equação de Kepler e posição a partir dos elementos do JPL |
| `sky.js` | céu de fundo com a faixa da Via Láctea |
| `level.js` | base dos níveis e formato dos "picks" (astros clicáveis) |
| `solar.js` | nível 1: Sol, planetas, luas, cometa, sondas, cinturões e asteroides da semana |
| `galaxy.js` | nível 2: ~95 mil partículas, braços, objetos e a nuvem de exoplanetas |
| `universe.js` | nível 3: galáxias e estruturas |
| `labels.js` | rótulos HTML, anti-sobreposição, hover e clique |
| `index.js` | câmera, voos, troca de nível, controle do tempo, HUD e loop de renderização |

**Como uma órbita vira posição** (`orbits.js`):

1. Anomalia média na data simulada: `M = ma + n · (jd − época)`.
2. Equação de Kepler `M = E − e·sen E`, resolvida por Newton-Raphson.
3. Posição no plano da órbita: `x = a(cos E − e)`, `y = a√(1−e²) sen E`.
4. Rotações por ω, i e Ω levam do plano da órbita para a eclíptica.

O tempo simulado é uma data juliana (`state.jd`), avançada a cada quadro conforme a
velocidade escolhida (de 1 hora a 100 anos por segundo, para frente ou para trás).

**Escalas:** nível 1 em UA, nível 2 em mil anos-luz e nível 3 em milhões de anos-luz.
Afastar além do limite de um nível passa para o próximo; aproximar do Sol (na Via Láctea)
ou da Via Láctea (no Universo) volta.

### Rodar o frontend separado do backend
Por padrão o backend serve a pasta `frontend/`. Para rodá-lo em outro servidor:

```bash
cd frontend && python -m http.server 5173
```

E em `frontend/js/config.js` troque `API_BASE` para `'http://127.0.0.1:8000'` (o CORS já
libera `localhost:5173`; outras origens vão em `CORS_ORIGINS` no `.env`).

## 11. Testes

- **`tests/conftest.py`:** cada teste recebe uma aplicação nova (`create_app`) com banco
  SQLite temporário e a NASA simulada. A fixture `make_client` permite criar várias
  "instâncias do servidor" sobre o mesmo banco, para testar o cache entre reinícios.
- **`tests/nasa_mock.py`:** um `httpx.MockTransport` que responde como cada API real
  (o mesmo texto CSV do Horizons, o JSON do SBDB, do NeoWs...). Também simula falhas:
  `make_client(fail={"horizons", "sbdb"})`.
- **`tests/fixtures/`:** respostas de exemplo no formato das APIs.

| Arquivo | O que testa |
|---|---|
| `test_app.py` | factory, `/api/health`, a chave nunca aparece nas respostas, frontend e docs |
| `test_catalog.py` | níveis, seed, filtros, relacionamento lua → planeta, 404 |
| `test_orbits.py` | órbitas do JPL, cálculo do Halley, sondas, fallback e persistência |
| `test_live_data.py` | asteroides, limite, 503, cache vencido, exoplanetas, APOD, EPIC, imagens, erupções |
| `test_parsers.py` | interpretação do Horizons e SBDB, conversão galáctica, classes de erupção |
| `test_cli.py` | comandos `atlas init-db`, `seed` e `--help` |

```bash
invoke test     # ou: pytest -v
invoke cov      # cobertura (≈ 87% do pacote atlas)
```

## 12. Como estender o projeto

**Adicionar um astro** (ex.: a lua Encélado):
1. Em `atlas/catalog/data/catalog.json`, copie o bloco de uma lua parecida e ajuste
   `slug`, textos, `parent: "saturno"`, `render` (raio, textura) e `nasa.horizons: "602"`
   (o código do Horizons).
2. Rode `atlas seed --replace` e recarregue a página. A órbita vem sozinha do JPL.

**Usar outra API da NASA:**
1. Crie o cliente em `atlas/ext/nasa/<nome>.py` (herde de `KeyedClient` se exigir chave).
2. Registre-o no `NasaGateway` (`atlas/ext/nasa/__init__.py`).
3. Crie o domínio (`schemas.py`, `services.py` com `cache.remember`, `routes.py` e
   `__init__.py` com `init_app`) e adicione-o a `DOMAINS` em `atlas/__init__.py`.
4. Adicione a resposta simulada em `tests/nasa_mock.py` e escreva os testes.

**Trocar SQLite por PostgreSQL:** instale `asyncpg` e defina
`DATABASE_URL=postgresql+asyncpg://usuario:senha@host/atlas`.

**Produção:** `ENVIRONMENT=production`, `DEBUG=false` e
`uvicorn app:app --host 0.0.0.0 --port 8000 --workers 2` atrás de um proxy reverso (Nginx).
Com mais de um processo, o cache continua coerente porque fica no banco.

## 13. Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| Painel "Dados da NASA" vermelho e órbitas "aproximadas" | sem internet ou JPL fora do ar. Rode `atlas refresh` depois; o site funciona mesmo assim |
| `HTTP 429` / "limite de requisições" | a DEMO_KEY acabou. Coloque sua chave no `.env` |
| `HTTP 403` em APOD/NeoWs | chave inválida ou digitada errada no `.env` |
| Página em branco com "Não foi possível iniciar" | o backend não está rodando, ou `config.js` aponta para outro endereço |
| Fotos dos cards não aparecem | a NASA Image Library está lenta; tente de novo (fica em cache por 7 dias) |
| Alterei o `catalog.json` e nada mudou | rode `atlas seed --replace` |
| Quero começar do zero | `atlas init-db --reset` (ou apague a pasta `instance/`) |
