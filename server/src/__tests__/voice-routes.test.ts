import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { voiceRoutes } from "../routes/voice.js";
import { createGatewayEngine } from "../services/voice-gateway.js";
import { errorHandler } from "../middleware/error-handler.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const otherCompanyId = "22222222-2222-4222-8222-222222222222";

type Seen = { url: string; body?: unknown };
function fakeGateway(name: string, opts: { down?: boolean } = {}, seen: Seen[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (opts.down) throw new Error("ECONNREFUSED");
    seen.push({ url: `${name}${new URL(url).pathname}`, body: init?.body });
    if (url.endsWith("/v1/audio/transcriptions")) return Response.json({ text: ` hello from ${name} ` });
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } });
  }) as typeof fetch;
}

function app(engines: Parameters<typeof voiceRoutes>[0], actor?: Record<string, unknown>) {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    req.actor = (actor ?? { type: "board", userId: "alice", source: "session", companyIds: [companyId], memberships: [{ companyId, membershipRole: "member", status: "active" }] }) as never;
    next();
  });
  server.use("/api", voiceRoutes(engines));
  server.use(errorHandler);
  return server;
}

const transcribe = (server: express.Express, body: Buffer | string = Buffer.from("audio"), cid = companyId) =>
  request(server).post(`/api/companies/${cid}/voice/transcribe`).set("Content-Type", "audio/webm").send(body);
const speak = (server: express.Express, body: unknown, cid = companyId) =>
  request(server).post(`/api/companies/${cid}/voice/speak`).send(body as object);

describe("voice routes", () => {
  it("transcribes a clip through the gateway", async () => {
    const res = await transcribe(app([createGatewayEngine("http://primary", fakeGateway("primary"))]));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: "hello from primary" });
  });

  it("falls back when the primary engine is down, and errors clearly when all are down", async () => {
    const seen: Seen[] = [];
    const engines = [
      createGatewayEngine("http://primary", fakeGateway("primary", { down: true })),
      createGatewayEngine("http://fallback", fakeGateway("fallback", {}, seen)),
    ];
    expect((await transcribe(app(engines))).body.text).toBe("hello from fallback");
    const allDown = app([createGatewayEngine("http://primary", fakeGateway("primary", { down: true }))]);
    const res = await speak(allDown, { text: "hi" });
    expect(res.status).toBe(503);
    expect(res.body.details.code).toBe("VOICE_UNAVAILABLE");
  });

  it("returns audio and sends only speakable text to the engine", async () => {
    const seen: Seen[] = [];
    const server = app([createGatewayEngine("http://primary", fakeGateway("primary", {}, seen))]);
    const res = await speak(server, { text: "# Title\nSee [docs](https://x.io/a/b).\n```js\nsecret()\n```\n**Done**" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("audio/mpeg");
    expect(Buffer.from(res.body).length).toBe(3);
    const sent = JSON.parse(String(seen[0]!.body));
    expect(sent.input).toBe("Title See docs. Done");
    expect(sent.voice).toBe("jarvis");
  });

  it("rejects empty speech, empty and oversize clips", async () => {
    const server = app([createGatewayEngine("http://primary", fakeGateway("primary"))]);
    expect((await speak(server, { text: "```code only```" })).status).toBe(400);
    expect((await transcribe(server, Buffer.alloc(0))).status).toBe(400);
    expect((await transcribe(server, Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
  });

  it("rejects unauthenticated callers and other companies", async () => {
    const engines = [createGatewayEngine("http://primary", fakeGateway("primary"))];
    expect((await speak(app(engines, { type: "none" }), { text: "hi" })).status).toBe(401);
    expect((await transcribe(app(engines, { type: "none" }))).status).toBe(401);
    expect((await speak(app(engines), { text: "hi" }, otherCompanyId)).status).toBe(403);
  });
});
