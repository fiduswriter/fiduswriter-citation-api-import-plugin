import {BibLatexParser} from "bibliojson"

import {Dialog, ensureCSS} from "../common"
import {CrossrefSearcher} from "./crossref"
import {DataciteSearcher} from "./datacite"
import {GesisSearcher} from "./gesis"
import {PubmedSearcher} from "./pubmed"
import {searchApiTemplate} from "./templates"
//import {ZenonSearcher} from "./zenon"

export class BibLatexApiImporter {
    constructor(bibDB, addToListCall) {
        this.bibDB = bibDB
        this.addToListCall = addToListCall
        this.dialog = false
        this.searchers = []
    }

    init() {
        ensureCSS(["citation_api_import.css"])
        // Add search providers
        this.searchers.push(new DataciteSearcher(this))
        this.searchers.push(new CrossrefSearcher(this))
        this.searchers.push(new GesisSearcher(this))
        this.searchers.push(new PubmedSearcher(this))
        //this.searchers.push(new ZenonSearcher(this))
        // Add form to DOM
        this.dialog = new Dialog({
            width: 940,
            height: 460,
            scroll: true,
            buttons: [{type: "close"}],
            title: gettext("Search citation databases"),
            body: searchApiTemplate({searchers: this.searchers})
        })
        this.dialog.open()

        // Auto search for text 4 chars and longer
        document
            .querySelectorAll(
                "#bibimport-search-text,.bibimport-search-enabled"
            )
            .forEach(el =>
                el.addEventListener("input", () => {
                    const searchTerm = document.getElementById(
                        "bibimport-search-text"
                    ).value

                    if (searchTerm.length > 3) {
                        document
                            .querySelectorAll(".bibimport-search-result")
                            .forEach(searchEl => (searchEl.innerHTML = ""))
                        document.getElementById(
                            "bibimport-search-header"
                        ).innerHTML = gettext("Looking...")
                        this.search(searchTerm)
                    }
                })
            )
        // Search per button press for text between 2 and 3 chars.
        document
            .getElementById("bibimport-search-button")
            .addEventListener("click", () => {
                const searchTerm = document.getElementById(
                    "bibimport-search-text"
                ).value

                if (searchTerm.length > 1 && searchTerm.length < 4) {
                    document
                        .querySelectorAll(".bibimport-search-result")
                        .forEach(searchEl => (searchEl.innerHTML = ""))
                    document.getElementById(
                        "bibimport-search-header"
                    ).innerHTML = gettext("Looking...")
                    this.search(searchTerm)
                }
            })
    }

    search(searchTerm) {
        if (!document.querySelector(".bibimport-search-enabled:checked")) {
            document.getElementById("bibimport-search-header").innerHTML =
                gettext("Select at least one search engine.")
            return
        }
        const lookups = this.searchers.map(searcher => {
            if (
                document.getElementById(`bibimport-enable-${searcher.id}`)
                    .checked
            ) {
                return searcher.lookup(searchTerm)
            } else {
                return Promise.resolve()
            }
        })

        Promise.all(lookups).then(() => {
            // Remove 'looking...' when all searches have finished if window is still there.
            const searchHeader = document.getElementById(
                "bibimport-search-header"
            )
            if (searchHeader) {
                searchHeader.innerHTML = ""
            }
        })
    }

    importBibtex(bibtex) {
        // Mostly copied from ./file.js
        const bibData = new BibLatexParser(bibtex)
        const tmpDB = bibData.parse().entries

        const bibKeys = Object.keys(tmpDB)
        // There should only be one bibkey
        // We iterate anyway, just in case there is more than one.
        bibKeys.forEach(bibKey => {
            const bibEntry = tmpDB[bibKey]
            // We add an empty category list for all newly imported bib entries.
            bibEntry.cats = []
            // If the entry has no title, add an empty title
            if (!bibEntry.fields.title) {
                bibEntry.fields.title = []
            }
            // If the entry has no date, add an uncertain date
            if (!bibEntry.fields.date) {
                if (bibEntry.fields.year) {
                    bibEntry.fields.date = bibEntry.fields.year
                } else {
                    bibEntry.fields.date = "uuuu"
                }
            }
            // If the entry has no editor or author, add empty author
            if (!bibEntry.fields.author && !bibEntry.fields.editor) {
                bibEntry.fields.author = [{literal: []}]
            }
        })
        this.bibDB.saveBibEntries(tmpDB, true).then(idTranslations => {
            const newIds = idTranslations.map(idTrans => idTrans[1])
            this.addToListCall(newIds)
        })
    }
}
