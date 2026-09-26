import { handoffOrder } from "./order_handoff";

const buyerEmail = process.env.DEMO_BUYER_EMAIL;
const sellerEmail = process.env.DEMO_SELLER_EMAIL;
if (!buyerEmail || !sellerEmail) {
  throw new Error("DEMO_BUYER_EMAIL and DEMO_SELLER_EMAIL are required");
}

const result = await handoffOrder({
  orderId: "ORD-2048",
  assetName: "Launch icon pack",
  license: "commercial",
  buyer: { name: "Mina", email: buyerEmail },
  seller: { displayName: "North Pier Studio", email: sellerEmail },
  updates: [
    { date: "2026-09-18", note: "Source files reviewed" },
    { date: "2026-09-21", note: "Commercial license issued" },
  ],
  deliveryUrl: "https://example.com/orders/ORD-2048/download",
});

console.log(JSON.stringify(result, null, 2));
