import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_email";
import { handoffOrder } from "./order_handoff";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/order-handoffs") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = await handoffOrder(body);
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.code }));
      return;
    }
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "request_failed" }));
  }
});

server.listen(port, () => console.log(`Order handoff service listening on http://localhost:${port}`));
