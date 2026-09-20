# TamperMonkey Scripts

Useful TamperMonkey scripts organized by website.

## GLobal Scripts

### Shipment Tracking Tab Labels

[scripts/global-shipment-tracking-tab-labels.js](scripts/global-shipment-tracking-tab-labels.js)

Adds persistent custom browser-tab labels to individual USPS and UPS tracking pages. The tab title displays the custom label followed by the shipment’s current status:

```text
Card shipment to Mike — In Transit
```

## Site-Specific

### District

#### District Product List Full Title Display

[scripts/district-admin-product-list-full-titles.js](scripts/district-admin-product-list-full-titles.js)

Displays complete product titles on the District admin product list. Titles wrap onto additional lines instead of being truncated, making the complete title visible and searchable with the browser’s page search.

#### District Order Item eBay Search Links

[scripts/district-admin-order-ebay-links.js](scripts/district-admin-order-ebay-links.js)

Adds eBay search links to the sold items in a District order. Hovering any word in an item's title in the order panel shows a small bubble underneath it that opens an eBay active-listings search for that word in a new tab, making it quick to find and remove the matching listing. Hyphenated words and SKUs such as `pk7-298` are treated as a single word, and a leading `#` is dropped from card numbers, so `#311` searches for `311`.

### YouTube

#### YouTube Exact Dates

[scripts/youtube-exact-dates.js](scripts/youtube-exact-dates.js)

Replaces relative dates such as `Streamed 3 months ago` with the stream’s exact local date and time:

```text
2026-05-17 8:30 PM
```
