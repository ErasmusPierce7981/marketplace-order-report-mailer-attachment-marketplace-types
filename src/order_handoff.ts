import { z } from "zod";
import { emailOperationId, infrai } from "./infrai_email";
import { generateBuyerReport, type MarketplaceOrder } from "./marketplace_report";

export const handoffRequestSchema = z.object({
  orderId: z.string().min(1),
  assetName: z.string().min(1),
  license: z.enum(["personal", "commercial"]),
  buyer: z.object({ name: z.string().min(1), email: z.string().email() }),
  seller: z.object({ displayName: z.string().min(1), email: z.string().email() }),
  updates: z.array(z.object({ date: z.string().date(), note: z.string().min(1) })).min(1),
  deliveryUrl: z.string().url(),
});

export type HandoffRequest = z.infer<typeof handoffRequestSchema>;

export type MailPlan = {
  audience: "buyer" | "seller";
  to: string;
  subject: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] as string);
}

export function buildMailPlans(order: MarketplaceOrder, pdf: Uint8Array): MailPlan[] {
  const safeOrderId = escapeHtml(order.orderId);
  const safeAsset = escapeHtml(order.assetName);
  const reportHref = `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;
  return [
    {
      audience: "buyer",
      to: order.buyer.email,
      subject: `Your ${order.assetName} handoff (${order.orderId})`,
      html: `<h1>Your asset is ready</h1><p>${safeAsset} for order ${safeOrderId} is ready.</p><p><a download="${safeOrderId}-report.pdf" href="${reportHref}">Download the PDF report</a></p>`,
    },
    {
      audience: "seller",
      to: order.seller.email,
      subject: `Handoff recorded for ${order.orderId}`,
      html: `<h1>Order handed off</h1><p>${safeAsset} was handed to ${escapeHtml(order.buyer.name)}.</p><p>Order: ${safeOrderId}</p>`,
    },
  ];
}

export async function handoffOrder(input: unknown): Promise<{
  orderId: string;
  state: "handed_off";
  deliveries: Array<{ audience: "buyer" | "seller"; messageId: string }>;
}> {
  const order = handoffRequestSchema.parse(input);
  const pdf = await generateBuyerReport(order);
  const plans = buildMailPlans(order, pdf);
  const deliveries = [];

  for (const plan of plans) {
    const sent = await infrai.email.send(
      { to: plan.to, subject: plan.subject, html: plan.html },
      emailOperationId(order.orderId, plan.audience),
    );
    deliveries.push({ audience: plan.audience, messageId: sent.message_id });
  }

  return { orderId: order.orderId, state: "handed_off", deliveries };
}
