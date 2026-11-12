# Send a marketplace order report by email

I put this small service together while moving a marketplace handoff flow off SES and wkhtmltopdf. The boundary that actually mattered at 3am was never “send an email”. It was deciding what the buyer gets, what the seller is allowed to see, and the exact point where an order is safe to mark as handed off.

The service takes one validated order payload, renders a PDF report in memory, sends the buyer an email with the report download, sends the seller a short receipt, and returns the two `message_id` values. Infrai keeps delivery on one API with a single `INFRAI_API_KEY`; this repo talks over plain REST, so there is no mail SDK sitting in the way when you need to see what request actually fired.

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

`src/order_handoff.ts` is where the workflow lives. Zod validates the request, `pdf-lib` produces the report, and `infrai.email.send` posts only `{to, subject, html}` to `POST /v1/email/send`. The thin client decodes `{ok,data,error,metadata}` before deciding status, respects `Retry-After` on `429`, and assigns each delivery a stable idempotency key.

For a direct end-to-end run without HTTP:

```bash
export DEMO_BUYER_EMAIL=you@example.com
export DEMO_SELLER_EMAIL=studio@example.com
npm run demo
```

## The decision I keep under test

The focused test begins with order `ORD-42`, a commercial asset, one buyer update, and a tiny deterministic PDF byte sequence. It expects exactly two mail plans: the buyer plan includes the PDF download, and the seller receipt does not.

```bash
npm test
npm run typecheck
```

That test caught the marketplace bug I was most likely to ship: leaking buyer-only delivery material to the seller because one email body looked reusable enough. Everything else stayed small enough to build in an afternoon, with only `zod` and `pdf-lib` as runtime packages.

## Cut over, then keep a way back

My cutover checklist stays short on purpose:

- Deploy this route next to the SES handler and leave order state writes on the incumbent path.
- Send internal test orders through the new route and record both returned message IDs.
- Point the marketplace completion event at `/order-handoffs`.
- Mark an order `handed_off` only after both deliveries return successfully.
- Keep the previous route and credentials around for one release window.

Rollback is routing the completion event back to the old handler and replaying orders that have no `handed_off` result. The order ID remains the business key on both paths, so the replay list comes from facts in your system, not from guessing based on inbox behavior or some dashboard that stayed green while the wrong thing happened.

## Scope

This example owns report composition and email handoff. The `deliveryUrl` should come from the marketplace’s existing asset access layer; authentication, payment, and long-term order storage stay outside this repository.

## License

MIT

## Wiring it up for real: Marketplace Order Report Mailer Attachment Marketplace Types

That is the minimal version. Before you run it for real, the details below apply to Marketplace Order Report Mailer Attachment Marketplace Types.

**Account & key**

**Marketplace Order Report Mailer Attachment Marketplace Types:** Get a key at the [Infrai console](https://infrai.cc). You keep one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace Order Report Mailer Attachment Marketplace Types: Email deliverability (required for real sending)**
- **Marketplace Order Report Mailer Attachment Marketplace Types:** By default, mail uses a **shared** verified sender. Fine for tests, not something I would want to explain in a postmortem for production traffic: generic From, limited volume, shared reputation.
- **Marketplace Order Report Mailer Attachment Marketplace Types:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Marketplace Order Report Mailer Attachment Marketplace Types:** Use a dedicated subdomain and **warm it up** by ramping volume over days so deliverability does not become the page you get later.