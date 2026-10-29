import express, { Router } from "express";
import { z } from "zod";
import { badRequest, HttpError, payloadTooLarge } from "../errors.js";
import { validate } from "../middleware/validate.js";
import {
  VOICE_MAX_CLIP_BYTES,
  VOICE_MAX_TTS_CHARS,
  VoiceUnavailableError,
  voiceEnginesFromEnv,
  voiceService,
  type SpeechEngine,
} from "../services/voice-gateway.js";
import { assertCompanyAccess } from "./authz.js";

const speakSchema = z.object({
  text: z.string().min(1).max(VOICE_MAX_TTS_CHARS * 4),
  voice: z.string().min(1).max(64).regex(/^[\w.-]+$/).optional(),
});

function unavailable(err: unknown): never {
  if (err instanceof VoiceUnavailableError) throw new HttpError(503, "Voice is unavailable right now", { code: "VOICE_UNAVAILABLE" });
  throw err;
}

export function voiceRoutes(engines: SpeechEngine[] = voiceEnginesFromEnv()) {
  const router = Router();
  const voice = voiceService(engines);
  const rawAudio = express.raw({ type: "audio/*", limit: VOICE_MAX_CLIP_BYTES });

  router.use("/companies/:companyId/voice", (req, _res, next) => {
    assertCompanyAccess(req, req.params.companyId as string);
    next();
  });

  router.get("/companies/:companyId/voice/status", async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await voice.status());
  });

  router.post("/companies/:companyId/voice/transcribe", (req, res, next) => {
    rawAudio(req, res, (err) => {
      if (err && (err as { type?: string }).type === "entity.too.large") return next(payloadTooLarge("Recording is too large"));
      next(err);
    });
  }, async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw badRequest("An audio recording is required");
    const text = await voice.transcribe(req.body, req.headers["content-type"] ?? "audio/webm").catch(unavailable);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ text });
  });

  router.post("/companies/:companyId/voice/speak", validate(speakSchema), async (req, res) => {
    const { text, voice: voiceName } = req.body as z.infer<typeof speakSchema>;
    const out = await voice.synthesize(text, voiceName ?? "jarvis").catch(unavailable);
    res.setHeader("Content-Type", out.contentType);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(out.audio);
  });

  return router;
}
