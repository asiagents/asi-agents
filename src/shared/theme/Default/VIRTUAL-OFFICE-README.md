# Pixar-Style Virtual Office — Integration Guide & README

This module provides a **Pixar-style virtual office surface** for **ASI Agents**. Agents are real roster entries bound to on-disk registry adapters (`config/agents.registry.json` and optional `config/ams-scan.agents.json`) with live status (working, idle, waiting, offline).

**Live route:** `/office` (`Office` page — Live floor + Hierarchy). Separate from `/group`. Desks bind to `GET /api/agents` only (fail-closed empty). Default bottom nav includes **Office** in Multi/Pro team mode.

---

## 🎨 Fire-Head Character Visuals & Role Palette

Each agent is rendered as a 3D Pixar-style fire-headed robot character with dynamic flame color-coding by role:

| Role Tag | Flame Color Palette | Visual Cue |
| :--- | :--- | :--- |
| **Chief / Lead** | Cyan / Electric Blue (`#00f3ff`) | High priority command flame |
| **Code / Dev / Engineer** | Amber / Plasma Orange (`#ff9900`) | Energetic code flickering |
| **Research / AI / Science** | Violet / Lavender (`#b066ff`) | Deep cognitive flame |
| **Design / UI / Art** | Pink / Magenta (`#ff3b9a`) | Creative plasma aura |
| **Security / Guard** | Crimson Red (`#ff3344`) | Sentinel protective flame |
| **Ops / Data / General** | Emerald Green (`#00e676`) | Operational steady flame |

---

## 🚀 Status Mapping & Animations

| Status | Flame Motion State | Visor Eyes Display | Monitor / Desk Surface |
| :--- | :--- | :--- | :--- |
| **Working / Active** | `@keyframes flame-flicker` (rapid energetic pulse) | Excited pill eyes with shine | Streaming green code typing lines (`type-line`) |
| **Idle** | `@keyframes flame-breathe` (smooth breathing glow) | Friendly round eyes | Dormant workstation display |
| **Waiting** | Warm amber glowing flame pulse | Inquisitive raised eyes | Waiting indicator tag |
| **Offline** | Desaturated dim monochrome ember | Closed X_X eyes | Dormant offline screen bar |
| **Speaking** | Soundwave audio ripple halo (`speaking-ripple`) | Glowing eye visor beam | Voice badge indicator |

---

## 🧩 React Component & Props API

### 1. `AgentDeskSprite` (`src/components/office/AgentDeskSprite.tsx`)
Interactive desk workstation card displaying the fire-head character, live typing monitor lines, model chip, and virtual desk indicator.

```typescript
export interface AgentDeskSpriteProps {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'working' | 'idle' | 'waiting' | 'offline' | string;
  modelLabel?: ModelId | string | null;
  speaking?: boolean;
  currentTask?: string;
  virtualDeskAvailable?: boolean;
  dim?: boolean;
  onClick?: () => void;
}
```

### 2. `MeetingSeat` (`src/components/office/MeetingSeat.tsx`)
Council and meeting room table seat with speaking waveform indicators.

```typescript
export interface MeetingSeatProps {
  id: string;
  name: string;
  role: string;
  status: string;
  modelLabel?: ModelId | string | null;
  speaking?: boolean;
  seatIndex?: number;
  onClick?: () => void;
}
```

### 3. `FireheadSprite` (`src/components/office/FireheadSprite.tsx`)
Pure character visual renderer with SVG Pixar firehead graphics and flame animations.

```typescript
export interface FireheadSpriteProps {
  id?: string;
  name?: string;
  role?: string;
  status?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  speaking?: boolean;
  className?: string;
}
```

---

## 📁 File Structure & Drop-In Instructions

To drop these components into your theme or main app (`src/shared/theme/Default/` or `src/app`):

```
src/shared/theme/Default/
├── public/
│   └── assets/
│       └── fireheads/
│           ├── roster_sheet.jpg     # Pixar roster design sheet asset
│           ├── desk_working.jpg     # Workstation preview asset
│           └── meeting_room.jpg     # Council room preview asset
├── src/
│   ├── components/
│   │   ├── AgentAvatar.tsx          # Integrated Firehead avatar renderer
│   │   ├── group/
│   │   │   └── MeetingRoom.tsx      # Round table meeting room with MeetingSeat
│   │   └── office/
│   │       ├── FireheadSprite.tsx   # Pixar firehead SVG & flame engine
│   │       ├── AgentDeskSprite.tsx  # Workstation desk component
│   │       ├── MeetingSeat.tsx      # Meeting room seat component
│   │       ├── OfficeFloor.tsx      # Virtual office floor layout
│   │       └── Plant.tsx            # Indoor greenery plants
│   ├── pages/
│   │   ├── Office.tsx               # Main virtual office page
│   │   └── Agents.tsx               # Roster grid with Pixar character cards
│   └── index.css                    # CSS animation keyframes & styles
```

---

## 🔒 Fail-Closed Local-First Registry

- **No Dummy Agents**: All surfaces scan `/api/agents` (backed by `config/agents.registry.json` and optional `config/ams-scan.agents.json`).
- **Empty State**: If scan is missing or empty, an elegant message guides the user to configure the on-disk registry.
