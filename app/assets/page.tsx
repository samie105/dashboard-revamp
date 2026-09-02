import { redirect } from "next/navigation"

/**
 * `/assets` merged into `/portfolio`.
 *
 * The two screens listed the same money in two shapes — Assets as every token
 * on every chain, Portfolio as six per-chain rows plus a trading summary the
 * Assets Spot tab already carried. The merged page keeps all of it.
 *
 * The route stays as a redirect rather than being deleted: it is linked from
 * the dashboard, the launcher, saved bookmarks and Vivid's destination map,
 * and a 404 is a worse answer than a move.
 */
export default function AssetsPage() {
  redirect("/portfolio")
}
