export const voiceProviders = [
{ id: 'local', name: 'Local TTS', detail: 'On-device, default. Uses your system voices.', kind: 'local', locked: true },
{ id: 'piper', name: 'Piper', detail: 'Local neural voices · stub', kind: 'local', locked: false },
{ id: 'elevenlabs', name: 'ElevenLabs', detail: 'Cloud voices · enable in Connections', kind: 'cloud', locked: false },
{ id: 'azure', name: 'Azure Speech', detail: 'Cloud voices · stub', kind: 'cloud', locked: false },
{ id: 'google', name: 'Google Cloud TTS', detail: 'Cloud voices · stub', kind: 'cloud', locked: false }];


export const voices = [
{ id: 'local-aria', name: 'Aria', provider: 'local' },
{ id: 'local-dev', name: 'Dev (Hinglish)', provider: 'local' },
{ id: 'piper-amy', name: 'Amy', provider: 'piper' },
{ id: 'el-rachel', name: 'Rachel', provider: 'elevenlabs' },
{ id: 'azure-neerja', name: 'Neerja', provider: 'azure' },
{ id: 'google-wavenet', name: 'Wavenet D', provider: 'google' }];