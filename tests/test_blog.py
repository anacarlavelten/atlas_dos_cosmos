"""Blog: linha do tempo (SNAPI), lançamentos (LL2) e tecnologias (Technology Transfer)."""

from nasa_mock import NEWS_REQUESTS

from atlas.blog.services import clean_summary


def test_topics_lists_filters(client):
    data = client.get("/api/blog/topics").json()
    assert [k["key"] for k in data["kinds"]] == ["articles", "blogs", "reports"]
    keys = [t["key"] for t in data["topics"]]
    assert keys[0] == "tudo" and "tecnologia" in keys
    assert data["tech_areas"]


def test_feed_shapes_posts(client):
    data = client.get("/api/blog/feed?limit=2").json()
    assert data["total"] == 36799
    assert data["has_more"] is True
    first = data["posts"][0]
    assert first["title"] == "Building a ‘highway to the moon’ with a catapult"
    assert first["summary"] == "Electromagnetic launch technology could cut costs […]"
    assert first["authors"] == ["SpaceNews Editor"]
    assert first["featured"] is True and first["launches"] == 1
    assert data["posts"][1]["image_url"] is None


def test_feed_sends_topic_terms_and_search(client):
    NEWS_REQUESTS.clear()
    client.get("/api/blog/feed?kind=blogs&topic=tecnologia&q=%20%20propulsion%20%20&offset=20")
    params = NEWS_REQUESTS[-1]
    assert "propulsion" in params["title_contains_one"].split(",")
    assert params["search"] == "propulsion"
    assert params["offset"] == "20"
    assert params["ordering"] == "-published_at"


def test_feed_is_cached(client):
    NEWS_REQUESTS.clear()
    client.get("/api/blog/feed?topic=lua-marte")
    client.get("/api/blog/feed?topic=lua-marte")
    assert len(NEWS_REQUESTS) == 1


def test_feed_rejects_unknown_options(client):
    assert client.get("/api/blog/feed?kind=podcasts").status_code == 404
    assert client.get("/api/blog/feed?topic=nao-existe").status_code == 404


def test_feed_unavailable_without_cache(make_client):
    r = make_client(fail={"news"}).get("/api/blog/feed")
    assert r.status_code == 503
    assert "Spaceflight News API" in r.json()["detail"]


def test_launches(client):
    launches = client.get("/api/blog/launches").json()["launches"]
    first, second = launches
    assert first["status_abbrev"] == "Go"
    assert first["rocket"] == "Long March 2C"
    assert first["orbit"] == "Low Earth Orbit"
    assert first["image_url"].endswith("long-march-thumb.jpeg")
    assert first["page_url"] == "https://spacelaunchnow.me/launch/long-march-2c-unknown-payload"
    assert second["mission"] is None and second["image_url"] is None


def test_technologies(client):
    data = client.get("/api/blog/technologies/robotica").json()
    first = data["items"][0]
    assert first["title"] == "Robot-Driven Blind Mate Interface"
    assert first["summary"] == "Many robot operations require connecting modules & tools."
    assert first["page_url"] == "https://technology.nasa.gov/patent/GSC-TOPS-247"
    assert len(data["items"]) == 2  # a linha incompleta é ignorada
    assert data["items"][1]["image_url"] is None
    assert client.get("/api/blog/technologies/culinaria").status_code == 404


def test_clean_summary_removes_wordpress_footer():
    text = "Resumo.\nThe post X appeared first on Site."
    assert clean_summary(text) == "Resumo."
