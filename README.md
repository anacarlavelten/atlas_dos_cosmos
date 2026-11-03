<div align="center">

# 🌌 Atlas do Cosmos

**Uma viagem em 3D do Sistema Solar até o Universo observável, com dados reais da NASA.**

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r170-000000?logo=threedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![Testes](https://img.shields.io/badge/testes-41%20passando-brightgreen)
![Cobertura](https://img.shields.io/badge/cobertura-91%25-brightgreen)

</div>

<!-- Coloque aqui uma captura de tela do site, por exemplo:
![Atlas do Cosmos](docs/img/screenshot.png) -->

O **Atlas do Cosmos** é uma simulação didática que roda no navegador, feita para crianças e
adultos. A viagem começa no Sistema Solar, passa pela Via Láctea e termina nas grandes
estruturas do Universo. Cada astro tem um card em português com resumo, tabela de dados e
curiosidade.

Os planetas se movem nas órbitas reais calculadas pelo JPL. Os asteroides que passam perto da
Terra são os desta semana, e as fotos, erupções solares e exoplanetas vêm direto das APIs da
NASA.

## ✨ Funcionalidades

- **3 níveis de escala com transição contínua:** Sistema Solar (em UA), Via Láctea (em
  milhares de anos-luz) e Universo (em milhões de anos-luz). Basta afastar a câmera para
  passar ao próximo nível.
- **71 astros no catálogo:** planetas, luas, planetas anões, o cometa Halley, as sondas
  Voyager 1 e 2 e New Horizons, estrelas, nebulosas, aglomerados, buracos negros, galáxias e
  grandes estruturas.
- **Órbitas reais:** posições calculadas pela equação de Kepler a partir dos elementos do
  JPL. O tempo anda de 1 hora a 100 anos por segundo, para frente ou para trás.
- **Dados ao vivo nos cards:** fotos da NASA de cada astro, erupções solares no Sol, foto da
  Terra inteira, asteroides da semana e estrelas com exoplanetas.
- **Foto astronômica do dia (APOD).**
- **Transparência:** o painel "Dados da NASA" mostra de onde veio cada informação (ao vivo,
  cache ou aproximação).
- **Funciona mesmo com a NASA fora do ar:** usa a última resposta guardada ou a tabela
  aproximada oficial do JPL.

## 🧰 Stack

| Camada | Tecnologias |
|---|---|
| **Backend** | Python 3.11+, [FastAPI](https://fastapi.tiangolo.com), Uvicorn, Pydantic, httpx, Typer |
| **Banco de dados** | SQLAlchemy 2 (assíncrono), PostgreSQL no [Supabase](https://supabase.com) (asyncpg) e SQLite em desenvolvimento (aiosqlite) |
| **Frontend** | [Vue 3](https://vuejs.org) e [Three.js](https://threejs.org), sem etapa de build |
| **Qualidade** | PyTest, pytest-cov, Ruff e Invoke |

## 🏗️ Arquitetura

```mermaid
flowchart LR
    U[Navegador<br/>Vue 3 + Three.js] -- "GET /api/..." --> B[Backend FastAPI]
    B -- SQL --> DB[(PostgreSQL<br/>Supabase)]
    B -- "HTTPS (com chave)" --> K[api.nasa.gov<br/>APOD · NeoWs · DONKI · EPIC]
    B -- "HTTPS (sem chave)" --> J[JPL Horizons · SBDB<br/>Image Library · Exoplanet Archive]
```

O navegador conversa **só com o backend**. Isso mantém a chave da NASA e a senha do banco
escondidas, permite guardar as respostas da NASA em cache e mantém o site no ar quando a NASA
falha.

O backend segue o padrão *Application Factory*, com extensões ligadas por `init_app` e um
pacote por domínio, cada um com `models`, `schemas`, `services` e `routes`. Os detalhes estão
em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## 🚀 Como rodar

Requisitos: **Python 3.11 ou mais novo** e um navegador atual (Chrome, Edge ou Firefox).

```bash
# 1. Clone e entre na pasta
git clone <url-do-repositorio>
cd atlas-cosmos

# 2. Crie o ambiente virtual e instale
python -m venv .venv
source .venv/bin/activate            # Windows (PowerShell): .\.venv\Scripts\Activate.ps1
pip install -e ".[dev,test]"

# 3. Configure (veja a seção abaixo)
cp .env.example .env                 # Windows (PowerShell): Copy-Item .env.example .env

# 4. Crie o banco e suba o servidor
atlas init-db
invoke run                           # ou: uvicorn app:app --reload
```

Abra **http://127.0.0.1:8000**. A documentação interativa da API fica em
**http://127.0.0.1:8000/api/docs**.

Na primeira execução, o catálogo é carregado no banco e as órbitas são buscadas no JPL em
segundo plano. Isso leva alguns segundos, e depois os dados ficam em cache.

## ⚙️ Configuração

Toda a configuração fica no arquivo `.env`, na raiz do projeto. O `.env` está no
`.gitignore`, então **nunca envie a sua chave ou a sua senha para o Git**. O `.env.example`
é o modelo e pode ser versionado.

### 🔑 Chave da NASA

1. Gere uma chave gratuita em https://api.nasa.gov.
2. No `.env`, troque `DEMO_KEY` pela sua chave:

   ```ini
   NASA_API_KEY=sua_chave_aqui
   ```

3. Teste com `atlas check-nasa`. Deve aparecer `OK! Foto do dia: ...` e a cota restante. No
   site, o botão **Dados da NASA** mostra se a chave está ativa.

Sem a chave, o projeto funciona com a `DEMO_KEY` pública, mas ela permite poucas requisições
por hora.

### 🗄️ Banco de dados no Supabase

Sem configuração, o projeto usa um SQLite local (`instance/atlas.db`). Para usar o Supabase:

1. No painel do projeto, clique em **Connect → Direct** e copie a URL do
   **Transaction pooler** (porta `6543`).
2. No `.env`, cole a URL trocando `[YOUR-PASSWORD]` pela senha do banco:

   ```ini
   DATABASE_URL=postgresql://postgres.SEU_PROJETO:SUA_SENHA@aws-0-REGIAO.pooler.supabase.com:6543/postgres?sslmode=require
   ```

   Se a senha tiver caracteres como `@`, `:` ou `/`, codifique-os (por exemplo, `@` vira
   `%40`).
3. Rode `atlas init-db` para criar as tabelas e carregar o catálogo. O comando mostra a URL
   com a senha escondida.

As tabelas são criadas com **RLS ligado** e sem *policies*. Assim, a API REST pública do
Supabase não lê nem altera nada. O backend conecta direto no Postgres e não é afetado.

Não há dados para migrar do SQLite: o catálogo vem do `catalog.json`, e órbitas e cache vêm
da NASA. O SQL completo das tabelas está em [`docs/banco.md`](docs/banco.md).

## 🛰️ De onde vêm os dados

| Dado | API | Precisa de chave? |
|---|---|---|
| Órbitas de planetas, luas e Plutão | JPL Horizons | não |
| Órbitas de Ceres e do cometa Halley | JPL Small-Body Database | não |
| Posição das Voyager 1 e 2 e da New Horizons | JPL Horizons | não |
| Asteroides que passam perto da Terra na semana | NeoWs | **sim** |
| Foto astronômica do dia | APOD | **sim** |
| Erupções solares dos últimos 30 dias (card do Sol) | DONKI | **sim** |
| Foto da Terra inteira (card da Terra) | EPIC | **sim** |
| Fotos de cada astro | NASA Image and Video Library | não |
| Estrelas com exoplanetas (mapa da Via Láctea) | NASA Exoplanet Archive | não |

Os **textos didáticos** em português (resumos, tabelas e curiosidades) não existem em nenhuma
API da NASA. Eles ficam no catálogo do projeto, em `atlas/catalog/data/catalog.json`.

## 🛠️ Comandos úteis

| Comando | O que faz |
|---|---|
| `invoke run` | Sobe o servidor de desenvolvimento (recarrega ao salvar) |
| `invoke test` / `invoke cov` | Roda os testes / com relatório de cobertura |
| `invoke lint` / `invoke format` | Verifica / formata o código com o Ruff |
| `atlas init-db [--reset]` | Cria (ou apaga e recria) as tabelas e carrega o catálogo |
| `atlas seed --replace` | Recarrega o catálogo depois de editar o `catalog.json` |
| `atlas refresh` | Atualiza agora as órbitas e as sondas a partir do JPL |
| `atlas check-nasa` | Testa a chave da NASA |
| `atlas shell` | Console Python com a aplicação, uma sessão do banco e os modelos |

## 📁 Estrutura

```
atlas-cosmos/
├── app.py              # ponto de entrada (uvicorn app:app)
├── atlas/              # backend FastAPI
│   ├── ext/            # infraestrutura: config, db, cache, clientes da NASA, web, cli
│   ├── catalog/        # astros e textos didáticos (data/catalog.json)
│   ├── orbits/         # órbitas do JPL e sondas
│   ├── neo/            # asteroides próximos da Terra
│   ├── exoplanets/     # estrelas com exoplanetas
│   ├── media/          # foto do dia, foto da Terra e fotos dos astros
│   └── spaceweather/   # erupções solares
├── frontend/           # Vue 3 + Three.js (componentes e motor 3D)
├── tests/              # PyTest com a NASA simulada
└── docs/               # documentação detalhada
```

## 🧪 Testes

```bash
invoke test      # ou: pytest
invoke cov       # com relatório de cobertura
```

São 41 testes, com 91% de cobertura. Eles **não acessam a internet**: `tests/nasa_mock.py`
simula todas as APIs da NASA no formato das respostas reais, incluindo falhas e cache
vencido. Cada teste usa um banco SQLite temporário.

## 🔭 Aproximações

- Os **tamanhos** dos astros são ampliados (×60 por padrão) para caberem na tela, mas as
  **distâncias** são reais. O controle "Tamanho dos astros" vai até ×1 (tamanho real).
- As **luas** usam a órbita real do JPL (inclinação e posição), mas com a distância ampliada
  junto com os tamanhos.
- Os **braços** da Via Láctea e os **cinturões de asteroides e de Kuiper** são
  representações. As **galáxias de fundo** do nível Universo são ilustrativas.
- As posições de galáxias e estrelas famosas vêm de coordenadas fixas do catálogo.

## 📚 Documentação

| Documento | Conteúdo |
|---|---|
| [`Documentacao.md`](Documentacao.md) | Visão completa: o que é, o que faz, stacks, arquitetura e banco |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Funcionamento interno: ciclo de vida, cache, motor 3D e mecânica orbital |
| [`docs/API.md`](docs/API.md) | Todas as rotas da API, com parâmetros e exemplos |
| [`docs/banco.md`](docs/banco.md) | Script SQL completo do banco e consultas úteis |

## 🙏 Créditos

- Dados: [NASA Open APIs](https://api.nasa.gov), [JPL Solar System Dynamics](https://ssd.jpl.nasa.gov)
  e [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu).
- [Vue.js](https://vuejs.org) e [Three.js](https://threejs.org), sob licença MIT (veja
  `frontend/vendor/`).

Projeto desenvolvido por **Pedro** para a disciplina, seguindo a arquitetura das apostilas
(Unidades 1 a 6) com FastAPI no lugar do Flask.
