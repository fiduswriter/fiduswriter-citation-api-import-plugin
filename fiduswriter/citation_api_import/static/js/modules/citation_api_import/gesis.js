import {get} from "../common"

import {searchApiResultGesisTemplate} from "./templates"

export class GesisSearcher {
    constructor(importer) {
        this.importer = importer
        this.id = "gesis"
        this.name = "GESIS"
    }

    bind() {
        document
            .querySelectorAll("#bibimport-search-result-gesis .api-import")
            .forEach(resultEl => {
                const id = resultEl.dataset.id,
                    type = resultEl.dataset.type
                resultEl.addEventListener("click", () =>
                    this.getBibtex(id, type)
                )
            })
    }

    lookup(searchTerm) {
        const searchQuery = {
            query: {
                bool: {
                    must: [
                        {
                            query_string: {
                                query: escape(searchTerm)
                            }
                        }
                    ],
                    should: [
                        // We only search types which make sense to cite.
                        {
                            term: {
                                type: "publication"
                            }
                        },
                        {
                            term: {
                                type: "research_data"
                            }
                        },
                        {
                            term: {
                                type: "instruments_tools"
                            }
                        },
                        {
                            term: {
                                type: "gesis_bib"
                            }
                        }
                    ],
                    minimum_should_match: 1
                }
            }
        }

        return fetch(
            `/api/citation_api_import/proxy/https://search.gesis.org/searchengine?source=${encodeURIComponent(JSON.stringify(searchQuery))}&source_content_type=${encodeURIComponent("application/json")}`,
            {
                method: "GET"
            }
        )
            .then(response => response.json())
            .then(json => {
                const items =
                    json.hits && json.hits.hits
                        ? json.hits.hits.map(hit => hit["_source"])
                        : []
                const searchEl = document.getElementById(
                    "bibimport-search-result-gesis"
                )
                if (!searchEl) {
                    // window was closed before result was ready.
                    return
                }
                if (items.length) {
                    searchEl.innerHTML = searchApiResultGesisTemplate({
                        items
                    })
                } else {
                    searchEl.innerHTML = ""
                }
                this.bind()
            })
    }

    getBibtex(id, type) {
        this.importer.dialog.close()
        get(
            "/api/citation_api_import/proxy/https://search.gesis.org/services/bibtex.php",
            {
                type,
                docid: id,
                download: "true",
                searchengine_mode: "ES8"
            }
        )
            .then(response => response.text())
            .then(bibtex => this.importer.importBibtex(bibtex))
    }
}
