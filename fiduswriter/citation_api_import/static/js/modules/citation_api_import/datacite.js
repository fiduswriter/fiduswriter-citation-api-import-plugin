import {getJson} from "../common"

import {searchApiResultDataciteTemplate} from "./templates"

export class DataciteSearcher {
    constructor(importer) {
        this.importer = importer
        this.id = "datacite"
        this.name = "Datacite"
    }

    bind() {
        document
            .querySelectorAll("#bibimport-search-result-datacite .api-import")
            .forEach(resultEl => {
                const doi = resultEl.dataset.doi
                resultEl.addEventListener("click", () => this.getBibtex(doi))
            })
    }

    lookup(searchTerm) {
        return getJson(
            "/api/citation_api_import/proxy/https://api.datacite.org/works",
            {query: escape(searchTerm)}
        ).then(json => {
            const items = json["data"].map(hit => hit.attributes)
            const searchEl = document.getElementById(
                "bibimport-search-result-datacite"
            )
            if (!searchEl) {
                // window was closed before result was ready.
                return
            }
            if (items.length) {
                searchEl.innerHTML = searchApiResultDataciteTemplate({items})
            } else {
                searchEl.innerHTML = ""
            }
            this.bind()
        })
    }

    getBibtex(doi) {
        this.importer.dialog.close()
        fetch(
            `/api/citation_api_import/proxy/https://api.datacite.org/dois/application/x-bibtex/${doi}`,
            {
                method: "GET"
            }
        )
            .then(response => response.text())
            .then(bibtex => this.importer.importBibtex(bibtex))
    }
}
