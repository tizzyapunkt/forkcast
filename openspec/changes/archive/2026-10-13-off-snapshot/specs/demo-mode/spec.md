## MODIFIED Requirements

### Requirement: Open Food Facts is queried from the visitor's browser
With the Open Food Facts source on, the demo SHALL answer name searches from a bundled snapshot of popular Open Food Facts products, without any network request, and SHALL send barcode lookups from the visitor's browser straight to Open Food Facts, without credentials or custom headers. Snapshot results SHALL be named per the active locale like live Open Food Facts results and keep the Open Food Facts source label.

#### Scenario: Barcode lookup
- **WHEN** a visitor scans or types a barcode Open Food Facts knows
- **THEN** the product is found, with the request sent from the visitor's browser

#### Scenario: Blocked Open Food Facts search
- **WHEN** a visitor searches with the catalog and Open Food Facts sources on and the Open Food Facts search fails (for example, the snapshot cannot be loaded)
- **THEN** the catalog results are shown

#### Scenario: Name search finds popular packaged products
- **WHEN** the active locale is `en`, the Open Food Facts source is on, and the visitor searches for `peanut butter`
- **THEN** packaged peanut butters from the snapshot appear after the catalog results, labelled Open Food Facts, and no request goes to Open Food Facts

#### Scenario: Snapshot results named in the active locale
- **WHEN** the active locale is `de` and a snapshot product has a German name
- **THEN** the result carries its German name

#### Scenario: Better matches rank first, then popularity
- **WHEN** a search matches one snapshot product's name exactly and another's only as a substring
- **THEN** the exact match ranks first; among equal matches the more-scanned product ranks first

### Requirement: The privacy policy covers the demo
The website's privacy policy in English and German SHALL state that the demo stores its data only in the visitor's browser, that name searches stay in the browser, and that barcode lookups go from the visitor's browser to Open Food Facts, which sees the visitor's IP address.

#### Scenario: Reading the privacy policy
- **WHEN** a visitor reads the privacy policy in English or German
- **THEN** it has a section on the demo covering browser storage, name searches staying local, and barcode lookups going to Open Food Facts

## ADDED Requirements

### Requirement: The snapshot is built from Open Food Facts and credited
The demo's snapshot SHALL hold the most-scanned Open Food Facts products sold in Germany, the United Kingdom and the United States that carry calories, built by a repeatable script and committed with its source, its licence (ODbL) and its build date. The demo's first-visit disclaimer SHALL credit Open Food Facts as the source of the product data under the ODbL.

#### Scenario: Rebuilding the snapshot
- **WHEN** a maintainer runs the snapshot script
- **THEN** it writes the snapshot file with products from all three countries, each with calories, plus the source, licence and build date

#### Scenario: Attribution in the demo
- **WHEN** a visitor reads the first-visit disclaimer
- **THEN** it says the product search uses data from Open Food Facts under the ODbL
