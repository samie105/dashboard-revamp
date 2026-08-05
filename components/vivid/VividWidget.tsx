"use client";

import Script from "next/script";

/**
 * The hosted Vivid voice widget for THIS app.
 *
 * Everything about how it behaves — persona, site knowledge, the routes it may
 * navigate to, the controls that need spoken confirmation — is configured in
 * the Vivid dashboard for the site "worldstreet dashboard"
 * (dashboardvivid.worldstreetgold.com/sites/c1fc8d07-…), NOT in this repo.
 * Changes there go live within ~30 seconds without a deploy. This component
 * only loads the script.
 *
 * NOT MOUNTED by default: the in-repo Vivid provider (components/
 * vivid-provider.tsx) already renders an orb with the same tools, and two orbs
 * would fight over the corner. Mount ONE of them in layout — this widget when
 * the hosted platform should own the dashboard's voice, the provider when the
 * in-repo stack should. The same data-vivid-target instrumentation feeds both.
 *
 * The key is publishable and is meant to sit in the page source; the site is
 * protected by the allowed-origins list on its config, not by hiding the key.
 */
const VIVID_API = "https://platformvivid.worldstreetgold.com";
const VIVID_KEY = "pk_live_oKYaENA_2KvUGxXnyrS77Eis";

export default function VividWidget() {
  return (
    <Script
      src={`${VIVID_API}/widget.js`}
      data-key={VIVID_KEY}
      data-api={VIVID_API}
      strategy="afterInteractive"
    />
  );
}
