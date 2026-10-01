import type { Express } from "express";
import { createChannelDraft, listChannelDrafts, patchChannelDraft, sendChannelDraft } from "./store.js";
import type { ChannelDraft } from "./types.js";

const CHANNELS = new Set<ChannelDraft["channel"]>(["gmail", "github", "telegram"]);

function isChannel(v: unknown): v is ChannelDraft["channel"] {
  return typeof v === "string" && CHANNELS.has(v as ChannelDraft["channel"]);
}

export function mountChannelRoutes(app: Express): void {
  app.get("/api/channels/drafts", (_req, res) => {
    res.json({ drafts: listChannelDrafts() });
  });

  app.post("/api/channels/drafts", (req, res) => {
    const channel = req.body?.channel;
    const title = String(req.body?.title ?? "").trim();
    const meta = String(req.body?.meta ?? "").trim();
    const to = String(req.body?.to ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    if (!isChannel(channel)) return res.status(400).json({ error: "channel must be gmail|github|telegram" });
    if (!title) return res.status(400).json({ error: "title required" });
    const draft = createChannelDraft({ channel, title, meta, to, body });
    res.status(201).json({ draft });
  });

  app.patch("/api/channels/drafts/:id", (req, res) => {
    const patch: Partial<Pick<ChannelDraft, "title" | "meta" | "to" | "body" | "channel">> = {};
    if (req.body?.channel != null) {
      if (!isChannel(req.body.channel)) return res.status(400).json({ error: "invalid channel" });
      patch.channel = req.body.channel;
    }
    if (req.body?.title != null) patch.title = String(req.body.title).trim();
    if (req.body?.meta != null) patch.meta = String(req.body.meta).trim();
    if (req.body?.to != null) patch.to = String(req.body.to).trim();
    if (req.body?.body != null) patch.body = String(req.body.body);
    const draft = patchChannelDraft(req.params.id, patch);
    if (!draft) return res.status(404).json({ error: "not found" });
    res.json({ draft });
  });

  app.post("/api/channels/drafts/:id/send", (req, res) => {
    const result = sendChannelDraft(req.params.id);
    if (!result) return res.status(404).json({ ok: false, message: "not found" });
    res.json(result);
  });
}
