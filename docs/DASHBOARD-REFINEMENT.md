# Dashboard visual refinement

The dashboard refinement in `components/dashboard-unauth/reference-dashboard.css` supersedes the earlier dashboard styling guidance. Preserve the existing information architecture and public preview routes.

- Use Satoshi, with 400 supporting text, 500 controls, 600 section titles and 700 only for the portfolio balance. Financial data uses tabular numerals.
- Canvas: #090B0D; sidebar: #0B0E10; primary surface: #0E1114; controls: #111519 and #151A1E; hover: #191E23.
- Use white borders at 5.5% opacity, 14–16px main radii, and no panel shadows. Reserve shadows for overlays.
- Keep the greeting integrated into the canvas and the balance tiles on one shared surface. The portfolio number and chart lead the hierarchy.
- Yellow is reserved for primary actions, selected states and chart data. Icons inherit neutral text; secondary table actions stay neutral until hover.
- Use existing WorldStreet raster assets for promotions. Do not construct promotional objects with CSS or SVG. Existing CoinAvatar asset sources remain in use.
- The demo chart supports pointer inspection and arrow-key inspection, with a crosshair, selected point and tooltip. Period transitions fade; reduced-motion preferences disable animation. Values remain simulated, not API-backed.
- Below 1450px the secondary column moves below primary content. Below 1024px navigation becomes a drawer. Below 768px portfolio regions stack and balances use two columns. Tables scroll horizontally without a visible scrollbar.
- Use 160ms interaction transitions and explicit keyboard focus. Scrolling stays enabled in the navigation, content and table.
