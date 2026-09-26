import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type MarketplaceOrder = {
  orderId: string;
  assetName: string;
  license: "personal" | "commercial";
  buyer: { name: string; email: string };
  seller: { displayName: string; email: string };
  updates: Array<{ date: string; note: string }>;
  deliveryUrl: string;
};

export async function generateBuyerReport(order: MarketplaceOrder): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let y = 740;

  const line = (text: string, size = 11, strong = false) => {
    page.drawText(text, {
      x: 54,
      y,
      size,
      font: strong ? bold : regular,
      color: rgb(0.12, 0.15, 0.2),
    });
    y -= size + 10;
  };

  line("Marketplace order handoff", 20, true);
  line(`Order: ${order.orderId}`);
  line(`Asset: ${order.assetName}`);
  line(`Seller: ${order.seller.displayName}`);
  line(`License: ${order.license}`);
  line(`Delivery: ${order.deliveryUrl}`);
  y -= 12;
  line("Buyer updates", 14, true);
  for (const update of order.updates) line(`${update.date}  ${update.note}`);

  return document.save();
}
