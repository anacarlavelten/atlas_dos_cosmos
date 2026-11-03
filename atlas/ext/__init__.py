"""Extensões de infraestrutura do Atlas do Cosmos.

Cada subpacote expõe ``init_app(app)`` e é ligado à aplicação dentro de
``create_app`` (padrão Application Factory):

* ``config``  — configuração por variáveis de ambiente / ``.env``
* ``db``      — SQLAlchemy 2.x assíncrono (engine, sessões, ``Base``)
* ``cache``   — cache persistente das respostas da NASA
* ``nasa``    — clientes das APIs da NASA/JPL
* ``web``     — CORS, GZip, erros, ``/api/health`` e o frontend estático
* ``cli``     — comandos de terminal (``atlas seed``, ``atlas refresh``...)
"""
