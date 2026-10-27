# Prototype verification — 2026-09-22

- Production build: passed (`npm run build`).
- Six mobile interaction tests: passed in Chromium with Pixel 7 emulation.
- Seven recipe parity tests: passed against the existing CyberChef 11.4.0 instance on `localhost:8888`. Compared raw bytes after the desktop app had received the input and finished the current bake.
- All 22 picker operations: upstream defaults accepted by the frontend's recipe validator.
- Responsive overflow check: passed at widths 320, 390, 768 and 1440 pixels.
- Screenshots inspected: phone input, recipe cards, operation picker, and desktop layout.
- Upstream worker size: about 5.2 MiB uncompressed; 1,515,969 bytes when gzipped. Operation modules load separately on demand. Vendored engine directory is about 42 MiB, including precompressed module copies.
- One local Chromium worker initialization measurement: 479 ms. This is a development-host measurement with locally available assets, not a cold mobile-network benchmark.

Parity cases: Base64 decoding, Unicode encoding, URL-to-hex chaining, SHA-256, gzip/gunzip roundtrip, JSON presentation, disabled recipe steps.

Interaction cases: phone navigation and stale output, recipe import/export and validation, binary file download fidelity, step ordering/toggling/removal, worker cancellation/recovery, and safe text display of HTML output.

No physical phone, iOS Safari, mobile-memory ceiling, or offline-install behavior has been tested. No production service or public endpoint was installed. Development preview binds to `127.0.0.1:5173`.

Screenshots: [Input](mobile-input.png), [Recipe](mobile-recipe.png), [Operation picker](mobile-operations.png), [Desktop](desktop.png).

## shadcn redesign — 2026-09-22

The interface now uses React and official shadcn/ui Radix Nova components with a neutral monochrome theme. Light, Dark and System preferences persist locally. System appearance updates while the app is open. A small pre-render script prevents a mismatched theme at startup.

Seven live CyberChef parity checks and eight interaction/appearance checks passed. The appearance checks cover persistence, live OS changes, and the operation picker at 320px in dark mode. The production build passes. The earlier screenshots above show the previous design; current screenshots are `shadcn-light-mobile.png`, `shadcn-dark-mobile.png`, `shadcn-dark-operations.png`, and `shadcn-dark-desktop.png`.

## Minimalist revision — 2026-09-22

Removed the workspace banner, repeated privacy text, tab icons, and separate panel toolbars. Desktop panels share a divided workspace; mobile uses plain underline tabs and a fixed Bake bar. Example/import/export are in the workspace menu. Step reordering and removal are in each step's menu; parameters expand on demand.

Production build and all eight UI checks passed; the phone flow and narrow dark-mode checks were rerun after the final parameter/background changes. Parameter expansion is also checked. Engine parity was not rerun because the engine was unchanged. Inspected updated screenshots: [Light mobile](minimal-light-mobile.png), [Dark mobile](minimal-dark-mobile.png), [Dark desktop](minimal-dark-desktop.png).

## Full operation catalogue — 2026-09-22

The picker now uses all 504 engine entries, with 16 upstream categories, unique alphabetical results, and name/description search. All 15 argument types are supported, including encoded string objects, preset population, optional numbers, option groups, multiline inputs, labels, and conditional fields. Default indices and the upstream string-valued numeric/boolean defaults are normalised. Large recipe imports keep their action buttons inside the mobile viewport.

Static HTML, images, SVGs and tables can be previewed in a scriptless, networkless sandbox. Extracted files retain their original names and bytes. Recognised image/PDF outputs have typed downloads. Script-driven charts and interactive upstream output actions are not reproduced; raw output remains downloadable. PDFs open through downloaded files. Network operations remain subject to browser CORS and permissions.

Added the pinned OCR, image-font, and RSA worker assets. The bridge repairs Jimp's malformed same-origin bitmap-font URL; the compiled CyberChef worker and operation modules remain unchanged. The engine directory is approximately 61 MiB including precompressed assets, loaded on demand.

New checks cover every operation's JSON default roundtrip and rendered form, all 504 picker entries, category/search filtering, AES against a known vector, regex and multi-field presets, flow control, QR rendering, archive/PDF download bytes, OCR, image fonts, and rich-output isolation. This is catalogue-wide form validation plus representative execution coverage, not an end-to-end bake of all 504 operations.

Screenshots: [Dark picker](catalog-dark-mobile.png), [Light picker](catalog-light-mobile.png), [Arguments](catalog-arguments-mobile.png), [QR output](catalog-qr-mobile.png).

Final verification: production build passed; all 24 Playwright checks passed (9 catalogue/output/asset checks, 8 existing UI checks, 7 parity checks against the running CyberChef). The built Tailscale preview was separately checked for all 504 picker entries and QR generation.

## Name-only search — 2026-09-22

Search now matches operation names only, preserving case-insensitive matching, all-word filtering, category filtering, and alphabetical ordering. Build passed. Verified the live results against the catalogue for `from`, `FrOm`, and `base64 from`, then baked a selected operation successfully.
