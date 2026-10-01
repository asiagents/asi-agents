/**
 * Models that are not text-chat LLMs (music / audio gen, TTS, STT, image/video gen).
 * Used to keep assignment pools and generate routing from treating them as chat backends.
 */

const NON_CHAT_RE =
  /lyria|musicgen|stable-?audio|riffusion|suno|udio\b|elevenlabs|eleven.?labs|bark\b|tts\b|whisper|speech.?to.?text|text.?to.?speech|vocode|melody|soundgen|audio\/|\/audio|imagen|dall-?e|stable.?diffusion|midjourney|flux\.|runway|veo-|sora\b|video.?gen|text->audio|text-to-audio|audio->audio/i;

export function isNonChatModelId(id: string, name = ""): boolean {
  const hay = `${id} ${name}`.trim();
  if (!hay) return false;
  return NON_CHAT_RE.test(hay);
}

export const NON_CHAT_MODEL_HINT =
  "That model is audio/music or another non-chat modality — pick a chat LLM for messaging.";
