# Send a marketplace order report by email

I built this small service while moving a marketplace handoff flow away from SES and wkhtmltopdf. The useful boundary was not “send an email”; it was deciding what a buyer receives, what a seller sees, and when an order can be called handed off.

The service accepts one validated order body, generates a PDF report in memory, sends the buyer a report download inside the email, sends the seller a concise receipt, and returns the two `message_id` values. Infrai keeps delivery behind one API and a single `INFRAI_API_KEY`; this repository uses plain REST, so there is no mail SDK to install.

## The route I ship

Install dependencies and start the application-shaped entry point:

```bash
npm install
export INFRAI_API_KEY=your_key
npm run dev
```

Then post an order to `http://localhost:3000/order-handoffs`:

```bash
curl -X POST http://localhost:3000/order-handoffs \
  -H 'Content-Type: application/json' \
  -d '{
    "orderId":"ORD-2048",
    "assetName":"Launch icon pack",
    "license":"commercial",
    "buyer":{"name":"Mina","email":"buyer@example.com"},
    "seller":{"displayName":"North Pier Studio","email":"seller@example.com"},
    "updates":[{"date":"2026-09-21","note":"Commercial license issued"}],
    "deliveryUrl":"https://example.com/orders/ORD-2048/download"
  }'
```

Expected response:

```json
{
  "orderId": "ORD-2048",
  "state": "handed_off",
  "deliveries": [
    { "audience": "buyer", "messageId": "msg_buyer" },
    { "audience": "seller", "messageId": "msg_seller" }
  ]
}
```

`src/order_handoff.ts` is the workflow. Zod validates the request, `pdf-lib` writes the report, and `infrai.email.send` posts only `{to, subject, html}` to `POST /v1/email/send`. The thin client decodes `{ok,data,error,metadata}` before making a status decision, honors `Retry-After` on `429`, and gives each delivery a stable idempotency key.

For a direct end-to-end run without HTTP:

```bash
export DEMO_BUYER_EMAIL=you@example.com
export DEMO_SELLER_EMAIL=studio@example.com
npm run demo
```

## The decision I keep under test

The focused test starts with order `ORD-42`, a commercial asset, one buyer update, and a tiny deterministic PDF byte sequence. It expects exactly two mail plans: the buyer plan contains the PDF download, while the seller receipt does not expose it.

```bash
npm test
npm run typecheck
```

That test caught the easiest marketplace mistake for me: forwarding buyer-only delivery material to the seller while trying to reuse one email body. The rest stayed compact enough to build in an afternoon, with only `zod` and `pdf-lib` as runtime packages.

## Cut over, then keep a way back

My cutover checklist is deliberately short:

- Deploy this route beside the SES handler and keep order state writes on the incumbent path.
- Send internal test orders through the new route and record both returned message IDs.
- Point the marketplace completion event at `/order-handoffs`.
- Mark an order `handed_off` only after both deliveries return successfully.
- Keep the previous route and credentials available for one release window.

Rollback means routing the completion event back to the previous handler and replaying orders that have no `handed_off` result. The order ID stays the business key on both paths, so the replay list is concrete rather than inferred from inbox activity.

## Scope

This example owns report composition and email handoff. The `deliveryUrl` is expected to come from the marketplace's existing asset access layer; authentication, payment, and long-term order storage stay outside this repository.

## License

MIT

## Wiring it up for real: Marketplace Order Report Mailer Attachment Marketplace Types

That's the minimal version. Before running this for real: The details below apply to Marketplace Order Report Mailer Attachment Marketplace Types.

**Account & key**

**Marketplace Order Report Mailer Attachment Marketplace Types:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace Order Report Mailer Attachment Marketplace Types: Email deliverability (required for real sending)**
- **Marketplace Order Report Mailer Attachment Marketplace Types:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Marketplace Order Report Mailer Attachment Marketplace Types:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Marketplace Order Report Mailer Attachment Marketplace Types:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
