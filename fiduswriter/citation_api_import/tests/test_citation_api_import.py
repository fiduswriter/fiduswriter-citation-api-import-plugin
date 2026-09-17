import time

import httpx
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from testing.live_server import ChannelsLiveServerTestCase
from testing.selenium_helper import SeleniumHelper


class CitationImportTest(SeleniumHelper, ChannelsLiveServerTestCase):
    fixtures = ["initial_documenttemplates.json", "initial_styles.json"]

    @classmethod
    def _mock_external_apis(cls):
        cls._orig_async_client_get = httpx.AsyncClient.get

        async def mock_get(self, url, **kwargs):
            if "api.crossref.org/v1/works?" in url:
                return httpx.Response(
                    200,
                    json={
                        "status": "ok",
                        "message": {
                            "items": [
                                {
                                    "DOI": "10.1234/example-money",
                                    "title": ["Money and Banking"],
                                    "author": [
                                        {"family": "Smith", "given": "John"}
                                    ],
                                    "published": {"date-parts": [[2020]]},
                                    "abstract": "<p>An example abstract.</p>",
                                }
                            ]
                        },
                    },
                )
            if "api.crossref.org/v1/works/" in url and "/transform" in url:
                return httpx.Response(
                    200,
                    text="@article{example-money,\n"
                    "  author = {Smith, John},\n"
                    "  title = {Money and Banking},\n"
                    "  journal = {Journal},\n"
                    "  year = {2020}\n"
                    "}",
                )
            if "search.gesis.org/searchengine" in url:
                return httpx.Response(
                    200,
                    json={
                        "hits": {
                            "hits": [
                                {
                                    "_source": {
                                        "id": "gesis-fish-1",
                                        "type": "publication",
                                        "title": ["Fish Ecology"],
                                        "person": ["John Doe"],
                                        "date": "2021",
                                        "abstract": "About fish.",
                                    }
                                }
                            ]
                        }
                    },
                )
            if "search.gesis.org/services/bibtex.php" in url:
                return httpx.Response(
                    200,
                    text="@article{gesis-fish-1,\n"
                    "  author = {Doe, John},\n"
                    "  title = {Fish Ecology},\n"
                    "  journal = {Journal},\n"
                    "  year = {2021}\n"
                    "}",
                )
            if "api.datacite.org/works" in url:
                return httpx.Response(200, json={"data": []})
            if "api.datacite.org/dois/application/x-bibtex/" in url:
                return httpx.Response(
                    200,
                    text="@article{datacite,\n"
                    "  author = {Author},\n"
                    "  title = {Title},\n"
                    "  year = {2021}\n"
                    "}",
                )
            if "zenon.dainst.org" in url:
                return httpx.Response(200, text="<html><body></body></html>")
            if "europepmc" in url:
                return httpx.Response(200, json={"resultList": {"result": []}})
            return httpx.Response(404)

        httpx.AsyncClient.get = mock_get

    @classmethod
    def _unmock_external_apis(cls):
        httpx.AsyncClient.get = cls._orig_async_client_get

    @classmethod
    def setUpClass(cls):
        cls._mock_external_apis()
        super().setUpClass()
        cls.base_url = cls.live_server_url
        driver_data = cls.get_drivers(1)
        cls.driver = driver_data["drivers"][0]
        cls.client = driver_data["clients"][0]
        cls.driver.implicitly_wait(driver_data["wait_time"])
        cls.wait_time = driver_data["wait_time"]

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        super().tearDownClass()
        cls._unmock_external_apis()

    def setUp(self):
        self.user = self.create_user(
            username="Yeti", email="yeti@snowman.com", passtext="otter1"
        )

    def test_import_on_bibliography_page(self):
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/bibliography")
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Import from Database"]'
        ).click()
        self.driver.find_element(By.ID, "bibimport-enable-crossref").click()
        self.driver.find_element(By.ID, "bibimport-search-text").send_keys(
            "Money"
        )
        WebDriverWait(self.driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button.api-import"))
        ).click()
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".edit-bib.fw-link-text")
            )
        )
        self.assertEqual(
            len(
                self.driver.find_elements(
                    By.CSS_SELECTOR, ".edit-bib.fw-link-text"
                )
            ),
            1,
        )

    def test_import_in_editor(self):
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(self.base_url + "/")
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-body").click()
        self.driver.find_element(
            By.CSS_SELECTOR, 'button[title="Cite"]'
        ).click()
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Import from database"]'
        ).click()
        self.driver.find_element(By.ID, "bibimport-enable-gesis").click()
        self.driver.find_element(By.ID, "bibimport-search-text").send_keys(
            "Fish"
        )
        WebDriverWait(self.driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button.api-import"))
        ).click()
        self.assertEqual(
            len(self.driver.find_elements(By.CSS_SELECTOR, "span.delete")), 1
        )
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Insert"]'
        ).click()
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "span.citation"))
        )
        self.assertEqual(
            len(self.driver.find_elements(By.CSS_SELECTOR, "span.citation")), 1
        )
        # Edit editor explicitly
        self.driver.get(self.base_url + "/")
        time.sleep(1)
