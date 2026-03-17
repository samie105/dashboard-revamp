import type { UnifiedTransaction } from "@/types/transactions"

export async function exportTransactionsPdf(transactions: UnifiedTransaction[]) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  doc.setFontSize(16)
  doc.text("Transaction History", 14, 15)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 21)

  const head = [["Date", "Type", "Status", "Token", "Amount", "Chain", "Fiat", "Tx Hash"]]

  const body = transactions.map((tx) => [
    new Date(tx.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    tx.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) +
      (tx.subType ? ` (${tx.subType})` : ""),
    tx.status,
    tx.token || "-",
    tx.amount != null ? String(tx.amount) : "-",
    tx.chain || "-",
    tx.fiatAmount != null && tx.fiatCurrency
      ? `${tx.fiatCurrency} ${tx.fiatAmount.toLocaleString()}`
      : "-",
    tx.txHash ? `${tx.txHash.slice(0, 12)}...` : "-",
  ])

  autoTable(doc, {
    startY: 26,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  doc.save("transactions.pdf")
}
