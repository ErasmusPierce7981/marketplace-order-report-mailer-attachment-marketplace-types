import assert from "node:assert/strict";
import test from "node:test";
import { buildMailPlans, handoffRequestSchema } from "../src/order_handoff";

test("the buyer gets the PDF report while the seller gets a handoff receipt", () => {
  const order = handoffRequestSchema.parse({
    orderId: "ORD-42",
    assetName: "Product photo presets",
    license: "commercial",
    buyer: { name: "Ari", email: "ari@example.com" },
    seller: { displayName: "Still Works", email: "studio@example.com" },
    updates: [{ date: "2026-09-21", note: "Download approved" }],
    deliveryUrl: "https://example.com/orders/ORD-42/download",
  });

  const plans = buildMailPlans(order, Uint8Array.from([37, 80, 68, 70]));
  assert.equal(plans.length, 2);
  assert.match(plans[0].html, /data:application\/pdf;base64,JVBERg==/);
  assert.equal(plans[0].audience, "buyer");
  assert.equal(plans[1].audience, "seller");
  assert.doesNotMatch(plans[1].html, /application\/pdf/);
});
