# 👑 THE 24 ELDERS ELITE CODING WAR ROOM REPORT (`666`)
**Project:** LipSyncer OpenArt AI Studio (`https://lipsyncer.web.app`)  
**Feature:** Omni Classic HTML Guide Parser (`Lord_I_Am_Grateful_OMNI_Classic_HTML_72.018BPM.html`) & **🧠 Genius Contextual Scene Intelligence (Lip-Sync vs. Just Animate)**

---

## 1. Executive Summary
The 24 Elders War Room has engineered and shipped the **Omni Classic HTML Guide Ingest & Genius Contextual Scene Intelligence Engine** across both **Full Song Video Mode** and the **20-Scene Storyboard Director**:

1. **Omni Classic HTML & TXT Guide Parser ([`omniHtmlGuideService.ts`](file:///d:/donwloads/LIPSYNCER/src/services/omniHtmlGuideService.ts)):**
   - Parses standalone Omni Navigator `.html` files (such as `Lord_I_Am_Grateful_OMNI_Classic_HTML_72.018BPM (1).html`) and `.txt` Command Boards, extracting all 20 scenes (`SCENE 01`..`SCENE 20`), exact `SONG EDIT WINDOW` timestamps (`00:00.0` to `02:43.0`), `PRE-LYRIC ACTION WINDOW`, `LIP-SYNC WINDOW`, `POST-LYRIC ACTION WINDOW`, `BAR 1 / PAUSE COMMAND AFTER BAR 1 / BAR 2` lyrics, and **both prompt editions**:
     - **🎤 Primary Omni Prompt (`PRIMARY_LIPSYNC` — Lip-Sync Version)**
     - **🎬 Action-Only Omni Prompt (`ACTION_ONLY_ANIMATE` — Just Animate / Non-Singing Story Version)**
   - Includes a 1-click **`📜 Load 72.018 BPM Omni HTML Guide`** preset (`getLordIAmGratefulOmniGuidePreset`) so you can immediately load or test all 20 scenes of *Lord I Am Grateful* (`72.018 BPM` / `164.04s`).

2. **🧠 Genius Contextual Scene Intelligence (`classifySceneEditionWithGeniusIntelligence`):**
   - Evaluates each scene's setting, image filename, and action prompts across **11 semantic setting categories** to automatically decide whether the scene should use **Lip-Sync (`PRIMARY_LIPSYNC`)** or **Just Animate (`ACTION_ONLY_ANIMATE` / No Lip-Sync)**:
     - **Automatically routed to `ACTION_ONLY_ANIMATE` (Just Animate / No Lip-Sync — 12 Scenes):**
       - **Market & Commerce:** Scene `05` (`05_Golden_Hour_Market_Handshake.png`) — *Shaking hands with a market vendor or inspecting fruit while singing mid-handshake looks unnatural; Action-Only keeps the mouth naturally relaxed while preserving warm human interaction.*
       - **Office & Workplace:** Scenes `03` (`Conference Room`), `04` (`Office Break Area`), `13` (`Office Mentorship`)
       - **Family & Domestic Activity:** Scenes `06` (`Family Grocery Unpacking`), `07` (`Father Adjusting Son School Backpack`), `08` (`Family Dinner Gathering`)
       - **Transit & Commute:** Scene `12` (`Contemplation On A City Bus`)
       - **Community Outreach & Service:** Scenes `14` (`Golden Hour Grocery Gift`), `15` (`Community Meal Distribution Day`)
       - **Instrumental Intro & Silent Prayer Circle:** Scenes `01` (`Bedroom Intro`), `18` (`Family Candlelit Prayer Circle`)
     - **Automatically routed to `PRIMARY_LIPSYNC` (Bar-by-Bar Lip-Sync Singing — 8 Singing Scenes):**
       - **Neighborhood Walk Serenade:** Scene `02` (`02_Golden_Walk_Through_The_Neighborhood.png`)
       - **Sanctuary & Worship:** Scenes `09` (`09_Heartfelt_Worship_In_Golden_Light.png`), `17` (`17_Joyful_Worship_Band_Performance.png`)
       - **Rooftop & Porch Testimony:** Scenes `10` (`Rooftop Reflection`), `11` (`Golden Porch Gospel`), `20` (`Grateful Heart Over The City`)
       - **Communal Celebration:** Scenes `16` (`Courtyard Celebration`), `19` (`Joyful Gospel Celebration`)

3. **2-Way Interactive Edition Switcher & Sub-Window Lip-Sync Lock:**
   - Every scene card in [`FullSongVideoModeView.tsx`](file:///d:/donwloads/LIPSYNCER/src/components/FullSongVideoModeView.tsx) and [`StoryboardDirectorView.tsx`](file:///d:/donwloads/LIPSYNCER/src/components/StoryboardDirectorView.tsx) displays its **Genius Setting Category**, **Reasoning**, a **2-Way Toggle (`🎤 Lip-Sync (Primary)` vs `🎬 Just Animate (Action-Only)`)**, and **1-Click Copy Primary / Copy Action-Only** buttons.
   - Bulk mode controls let you switch the entire board with 1 click: **`🧠 Apply Genius Scene Mix (Auto)`**, **`🎤 All Lip-Sync (Primary)`**, or **`🎬 All Just Animate (Action-Only)`**.
   - During the 60fps Master MP4 Merge (`mergeFullSongVideoMaster`), `ACTION_ONLY_ANIMATE` scenes keep the mouth naturally relaxed (`NO LIP-SYNC`), and `PRIMARY_LIPSYNC` scenes restrict jaw/lip viseme articulation strictly to the scene's `LIP-SYNC WINDOW` (`lipSyncStartRelSec`..`lipSyncEndRelSec`), keeping the mouth relaxed during the `PRE-LYRIC` and `POST-LYRIC` action windows.

---

## 2. Files Created & Updated
- [`src/services/omniHtmlGuideService.ts`](file:///d:/donwloads/LIPSYNCER/src/services/omniHtmlGuideService.ts) — Omni Classic HTML & TXT Guide parser, Genius Contextual Scene Classifier (`classifySceneEditionWithGeniusIntelligence`), and 20-scene `Lord I Am Grateful` (`72.018 BPM`) preset.
- [`src/services/fullSongVideoService.ts`](file:///d:/donwloads/LIPSYNCER/src/services/fullSongVideoService.ts) — Integrated `.html` guide ingestion into `unravelStoryboardFilesAndZips`, exact `SONG EDIT WINDOW` chunk alignment, `switchChunkPromptEdition`, and sub-window lip-sync viseme gating in `mergeFullSongVideoMaster`.
- [`src/components/FullSongVideoModeView.tsx`](file:///d:/donwloads/LIPSYNCER/src/components/FullSongVideoModeView.tsx) — Added `.html` guide upload, `📜 Load 72.018 BPM Guide` button, Genius Director Intelligence panel, filter tabs, and per-chunk 2-way Lip-Sync vs. Just-Animate switcher.
- [`src/components/StoryboardDirectorView.tsx`](file:///d:/donwloads/LIPSYNCER/src/components/StoryboardDirectorView.tsx) — Added `.html` guide upload, `📜 Load 72.018 BPM Omni HTML Guide` button, Genius Director Intelligence bar, and per-scene 2-way Lip-Sync vs. Just-Animate switcher.
- [`src/types.ts`](file:///d:/donwloads/LIPSYNCER/src/types.ts) — Added `OmniPromptEdition`, `GeniusSceneSettingCategory`, `OmniHtmlGuideSceneData`, and `OmniHtmlGuideParsedProject`.
- [`src/services/__tests__/lipsyncer.test.ts`](file:///d:/donwloads/LIPSYNCER/src/services/__tests__/lipsyncer.test.ts) — 15/15 passing Vitest unit tests including market setting (`05_Golden_Hour_Market_Handshake.png`) vs. worship setting (`09_Heartfelt_Worship_In_Golden_Light.png`) Genius classification and HTML DOM guide parsing.
