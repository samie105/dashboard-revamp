import { NextRequest, NextResponse } from "next/server";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";

/**
 * GET /api/hyperliquid/slippage-estimate?coin=PEPE&side=sell&amount=18000
 * Estimates the average fill price and slippage by walking the L2 order book.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coin = searchParams.get("coin");
    const side = searchParams.get("side");
    const amount = parseFloat(searchParams.get("amount") || "0");

    if (!coin || !side || !amount) {
      return NextResponse.json({ success: false, error: "Missing coin, side, or amount" }, { status: 400 });
    }

    const transport = new HttpTransport({ isTestnet: false });
    const info = new InfoClient({ transport });

    // Resolve coin to HL spot name
    const spotMeta = await info.spotMeta();
    let bookCoin = coin;

    const baseToken = spotMeta.tokens.find((t: { name: string }) => t.name === coin);
    if (baseToken) {
      const entry = spotMeta.universe.find((u: { tokens: number[] }) => u.tokens[0] === baseToken.index);
      if (entry) bookCoin = entry.name;
    }

    const [l2] = await Promise.all([
      info.l2Book({ coin: bookCoin }),
      info.allMids(),
    ]);

    if (!l2?.levels?.[0]?.length || !l2?.levels?.[1]?.length) {
      return NextResponse.json({
        success: true,
        data: { warning: "No order book data available for this pair" },
      });
    }

    const bestBid = parseFloat(l2.levels[0][0].px);
    const bestAsk = parseFloat(l2.levels[1][0].px);
    const midPrice = (bestBid + bestAsk) / 2;

    // Walk the relevant side of the book
    const levels = side === "buy"
      ? l2.levels[1].map((l: { px: string; sz: string }) => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }))
      : l2.levels[0].map((l: { px: string; sz: string }) => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }));

    let remaining = amount;
    let totalCost = 0;
    let totalFilled = 0;

    for (const level of levels) {
      if (remaining <= 0) break;
      const fill = Math.min(remaining, level.sz);
      totalCost += fill * level.px;
      totalFilled += fill;
      remaining -= fill;
    }

    const avgPrice = totalFilled > 0 ? totalCost / totalFilled : 0;
    const slippagePct = midPrice > 0 ? Math.abs(avgPrice - midPrice) / midPrice * 100 : 0;
    const estimatedValue = totalCost;
    const fullyFilled = remaining <= 0;

    return NextResponse.json({
      success: true,
      data: {
        midPrice,
        bestBid,
        bestAsk,
        estimatedAvgPrice: avgPrice,
        slippagePct: Math.round(slippagePct * 100) / 100,
        estimatedValue: Math.round(estimatedValue * 100) / 100,
        filledAmount: totalFilled,
        requestedAmount: amount,
        fullyFilled,
        warning: !fullyFilled
          ? `Only ${totalFilled.toFixed(2)} of ${amount} can be filled from the order book`
          : slippagePct > 3
            ? `High slippage: ${slippagePct.toFixed(1)}%`
            : null,
      },
    });
  } catch (error: unknown) {
    console.error("[Slippage Estimate] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to estimate slippage";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
