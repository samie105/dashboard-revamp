/**
 * Card hue — the tint that makes a pane read as lit rather than as a flat
 * dark rectangle.
 *
 * CardShell gives every card its fill, blur and corner-light ring. What it
 * does not give it is COLOUR: on this page that left a run of identical grey
 * slabs, and the silk field behind them barely registered. These add a warm
 * bloom biased to the top-left corner — where the design system's imaginary
 * light source already sits (the `inset 0 1px 0` bevel in CardShell assumes
 * the same) — so the tint and the bevel agree about where the light is.
 *
 * They are `background-image`, passed through `className`, NOT an absolutely
 * positioned overlay. A positioned child of CardShell paints ABOVE the card's
 * unpositioned content, so an overlay would wash the figures instead of
 * sitting behind them. A background-image layers over the card's
 * background-color and under everything else, which is exactly the order
 * wanted.
 *
 * Gold, not the reference's green: brand colour is the one thing an ambient
 * wash is allowed to spend, because it sits far below the contrast floor and
 * never carries meaning. Money direction stays on --credit/--debit.
 */

/**
 * The hero pane — the page's one lit surface, so it gets the full bloom.
 *
 * Four layers, and the last one is the one that does the real work: a flat
 * wash across the whole pane. The corner blooms alone read as *light spilling
 * onto* a grey card; the wash is what makes the card itself the colour, which
 * is what the reference does. With `bg-card/30` under it there is a lot of
 * near-black showing through, so these alphas are higher than they look.
 */
export const HERO_HUE =
  "bg-[radial-gradient(115%_85%_at_0%_0%,rgba(250,204,21,0.17)_0%,rgba(250,204,21,0.06)_38%,transparent_70%),radial-gradient(95%_75%_at_100%_0%,rgba(250,204,21,0.085)_0%,transparent_58%),radial-gradient(85%_65%_at_25%_100%,rgba(250,204,21,0.05)_0%,transparent_62%),linear-gradient(160deg,rgba(250,204,21,0.055)_0%,rgba(250,204,21,0.02)_55%,rgba(250,204,21,0.035)_100%)]"

/** Everything below the hero — the same light at roughly a third of the
 *  strength, so the cards belong to the hero without competing with it. */
export const CARD_HUE =
  "bg-[radial-gradient(110%_80%_at_0%_0%,rgba(250,204,21,0.07)_0%,transparent_64%),radial-gradient(90%_70%_at_100%_0%,rgba(250,204,21,0.035)_0%,transparent_60%),linear-gradient(160deg,rgba(250,204,21,0.022)_0%,rgba(250,204,21,0.01)_100%)]"
