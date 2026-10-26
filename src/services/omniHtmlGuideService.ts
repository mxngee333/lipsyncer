import {
  GeniusSceneSettingCategory,
  OmniHtmlGuideParsedProject,
  OmniHtmlGuideSceneData,
  OmniPromptEdition
} from '../types';

/**
 * Parses a timestamp like "01:14.6" or "00:31.8" into seconds (e.g. 74.6, 31.8).
 */
export function parseOmniTimestampSec(ts: string): number {
  const clean = (ts || '').trim();
  const m = clean.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (m) {
    return Math.round((parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 100) / 100;
  }
  const num = parseFloat(clean);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

/**
 * Parses a relative sub-window like "1.4s - 6.8s" into `{ startSec: 1.4, endSec: 6.8 }`.
 */
export function parseRelativeWindowSec(
  winText?: string
): { startSec: number; endSec: number } | null {
  if (!winText || /none/i.test(winText)) return null;
  const m = winText.match(/(\d+(?:\.\d+)?)\s*s?\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (!m) return null;
  const startSec = parseFloat(m[1]);
  const endSec = parseFloat(m[2]);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
    return null;
  }
  return { startSec, endSec };
}

/**
 * Extracts clean human-readable sung lines from a BAR-BY-BAR lyric block, e.g.:
 * BAR 1: "Lord I am grateful"
 * PAUSE COMMAND AFTER BAR 1: ...
 * BAR 2: "For a refreshing day"
 * -> "Lord I am grateful / For a refreshing day"
 */
export function extractCleanSungLyricsFromBars(barBlock: string): string {
  if (!barBlock || !barBlock.trim()) {
    return 'NONE - Instrumental / Narrative Only';
  }
  if (/NONE\s*-\s*(?:instrumental|action-only)/i.test(barBlock)) {
    return 'NONE - Instrumental / Narrative Only';
  }

  const barMatches = Array.from(
    barBlock.matchAll(/BAR\s+\d+\s*:\s*"([^"]+)"/gi)
  ).map((m) => m[1].trim());

  if (barMatches.length > 0) {
    return barMatches.join(' / ');
  }

  const quotedMatches = Array.from(barBlock.matchAll(/"([^"]+)"/g))
    .map((m) => m[1].trim())
    .filter((s) => !/NONE/i.test(s));

  if (quotedMatches.length > 0) {
    return quotedMatches.join(' / ');
  }

  return barBlock.split(/\r?\n/)[0]?.trim() || 'Vocal Phrase';
}

/**
 * 🧠 Genius Contextual Scene Classifier:
 * Evaluates a scene's visual setting, human interaction context, image filename, and action prompts
 * to determine whether the scene should use:
 * - `PRIMARY_LIPSYNC` (Bar-by-Bar Lip-Sync Singing Version)
 * - `ACTION_ONLY_ANIMATE` (Just Animate / Non-Singing Story Continuity Version)
 *
 * Concrete example from user:
 * In a market setting (`05_Golden_Hour_Market_Handshake.png`), shaking hands with a vendor or
 * inspecting fruit while lip-syncing looks unnatural — the Genius Classifier automatically selects
 * `ACTION_ONLY_ANIMATE` (Just Animate) for market, office, grocery, backpack, dinner, bus, and
 * hands-on community distribution scenes, while selecting `PRIMARY_LIPSYNC` for worship, neighborhood
 * walk serenade, rooftop, porch, band performance, and communal celebration scenes!
 */
export function classifySceneEditionWithGeniusIntelligence(params: {
  sceneNumber: number;
  imageFileName: string;
  sceneTitle?: string;
  guideDefaultMode?: 'LIP-SYNC' | 'NO LIP-SYNC';
  cleanSungLyrics?: string;
  primaryOmniPrompt?: string;
  actionOnlyOmniPrompt?: string;
}): {
  recommendedEdition: OmniPromptEdition;
  settingCategory: GeniusSceneSettingCategory;
  reason: string;
  confidence: number;
} {
  const {
    sceneNumber,
    imageFileName = '',
    sceneTitle = '',
    guideDefaultMode = 'LIP-SYNC',
    cleanSungLyrics = '',
    primaryOmniPrompt = '',
    actionOnlyOmniPrompt = ''
  } = params;

  const nameContext = `${imageFileName} ${sceneTitle}`.toLowerCase();
  const fullContext = `${nameContext} ${primaryOmniPrompt} ${actionOnlyOmniPrompt}`.toLowerCase();

  // 1. Explicit NO LIP-SYNC / Instrumental Intro (e.g. Scene 01 Bedroom Serenade Intro)
  if (
    guideDefaultMode === 'NO LIP-SYNC' ||
    /none\s*-\s*instrumental/i.test(cleanSungLyrics) ||
    sceneNumber === 1 && /bedroom|intro/i.test(nameContext)
  ) {
    return {
      recommendedEdition: 'ACTION_ONLY_ANIMATE',
      settingCategory: 'Instrumental Intro',
      reason:
        'Instrumental opening narrative — Just Animate (Action-Only) preserves calm breathing and morning room ambiance with zero lip movement.',
      confidence: 0.99
    };
  }

  // 2. Market / Vendor / Handshake / Shopping Commerce Setting (e.g. Scene 05 Golden Hour Market Handshake)
  if (
    /(?:market|handshake|vendor|fruit|bazaar|stall|merchant|shopping)/i.test(nameContext) ||
    /(?:inspects a piece of fruit|nods appreciatively to the vendor|market vendor)/i.test(fullContext)
  ) {
    return {
      recommendedEdition: 'ACTION_ONLY_ANIMATE',
      settingCategory: 'Market & Commerce',
      reason:
        'Market & vendor handshake setting — Just Animate (Action-Only) keeps fruit inspection and vendor greeting 100% natural without awkward mid-handshake singing.',
      confidence: 0.99
    };
  }

  // 3. Office / Conference Room / Break Area / Mentorship Setting (e.g. Scenes 03, 04, 13)
  if (
    /(?:conference|office|break[_\-\s]*area|camaraderie|mentorship|colleague|boardroom|workplace|laptop|desk)/i.test(
      nameContext
    )
  ) {
    return {
      recommendedEdition: 'ACTION_ONLY_ANIMATE',
      settingCategory: 'Office & Workplace',
      reason:
        'Office & colleague interaction setting — Just Animate (Action-Only) keeps notebook sharing, break-room camaraderie, and laptop mentorship authentic without singing at a desk.',
      confidence: 0.98
    };
  }

  // 4. Family & Domestic Activity: Grocery Unpacking / School Backpack / Dinner Serving / Doorstep Grocery Gift (e.g. Scenes 06, 07, 08, 14)
  if (
    /(?:grocery|unpacking|backpack|school|dinner|gathering|doorstep|gift|kitchen)/i.test(
      nameContext
    )
  ) {
    return {
      recommendedEdition: 'ACTION_ONLY_ANIMATE',
      settingCategory: 'Family & Domestic',
      reason:
        'Hands-on family & domestic interaction — Just Animate (Action-Only) lets grocery unpacking, school backpack adjustment, family dinner serving, and doorstep gifts play as warm cinematic B-roll.',
      confidence: 0.98
    };
  }

  // 5. Public Transit / City Bus Commute (e.g. Scene 12 Contemplation On A City Bus)
  if (/(?:bus|transit|commute|train|subway|passenger|window_reflection)/i.test(nameContext)) {
    return {
      recommendedEdition: 'ACTION_ONLY_ANIMATE',
      settingCategory: 'Transit & Commute',
      reason:
        'Public city bus contemplation — Just Animate (Action-Only) preserves natural window gaze and passing street reflections instead of singing aloud on public transit.',
      confidence: 0.98
    };
  }

  // 6. Community Meal Distribution / Volunteering Outreach (e.g. Scene 15 Community Meal Distribution Day)
  if (/(?:distribution|meal|outreach|volunteer|charity|serving_table)/i.test(nameContext)) {
    return {
      recommendedEdition: 'ACTION_ONLY_ANIMATE',
      settingCategory: 'Community Outreach',
      reason:
        'Active community meal handoff — Just Animate (Action-Only) focuses on warm eye contact and handing meal containers to recipients without interrupting the service action.',
      confidence: 0.97
    };
  }

  // 7. Silent Bowed Candlelit Prayer Circle (e.g. Scene 18 Family Candlelit Prayer Circle)
  if (/(?:candlelit|candlelight|prayer_circle|prayer_by_candlelight)/i.test(nameContext)) {
    return {
      recommendedEdition: 'ACTION_ONLY_ANIMATE',
      settingCategory: 'Silent Prayer Circle',
      reason:
        'Intimate bowed-head candlelit prayer circle — Just Animate (Action-Only) honors closed-eye reverence, gentle hand squeezes, and flickering candlelight.',
      confidence: 0.97
    };
  }

  // 8. Neighborhood Walk Serenade (e.g. Scene 02 Golden Walk Through The Neighborhood)
  if (/(?:walk|neighborhood|stroll|avenue)/i.test(nameContext)) {
    return {
      recommendedEdition: 'PRIMARY_LIPSYNC',
      settingCategory: 'Neighborhood Walk Serenade',
      reason:
        'Lead-vocal tracking walk — Lip-Sync (Primary) shines as the singer walks toward the backward-tracking camera delivering the opening verse bar by bar.',
      confidence: 0.99
    };
  }

  // 9. Sanctuary & Worship Band Performance (e.g. Scenes 09, 17)
  if (/(?:worship|sanctuary|band|rehearsal|congregation|choir|microphone)/i.test(nameContext)) {
    return {
      recommendedEdition: 'PRIMARY_LIPSYNC',
      settingCategory: 'Sanctuary & Worship',
      reason:
        'Sanctuary & live worship band setting — Lip-Sync (Primary) locks passionate bar-by-bar vocal delivery and breath pauses directly to the master vocal track.',
      confidence: 0.99
    };
  }

  // 10. Communal Courtyard / Gospel Celebration (e.g. Scenes 16, 19)
  if (/(?:courtyard|celebration|clapping_circle|gospel_celebration)/i.test(nameContext)) {
    return {
      recommendedEdition: 'PRIMARY_LIPSYNC',
      settingCategory: 'Communal Celebration',
      reason:
        'High-energy communal praise & celebration — Lip-Sync (Primary) drives the uplifting chorus and bridge while the group claps on the 72.018 BPM pulse.',
      confidence: 0.98
    };
  }

  // 11. Rooftop / Porch / Over The City Hero Vocal Testimony (e.g. Scenes 10, 11, 20)
  return {
    recommendedEdition: 'PRIMARY_LIPSYNC',
    settingCategory: 'Rooftop & Porch Testimony',
    reason:
      'Solo hero vocal testimony framing — Lip-Sync (Primary) anchors emotional direct-to-camera singing against the golden-hour skyline or porch.',
    confidence: 0.98
  };
}

function humanizeImageFileName(imageFileName: string, sceneCode: string): string {
  const clean = (imageFileName || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/^(?:scene[_\-\s]*)?\d{1,3}[_\-\s.]*/i, '')
    .replace(/[_\-]+/g, ' ')
    .trim();
  if (!clean) return `Scene ${sceneCode}`;
  return clean
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parsePlainOmniSceneBlock(sceneBlockText: string, fallbackIndex: number): OmniHtmlGuideSceneData | null {
  const sceneNumMatch =
    sceneBlockText.match(/SCENE\s+(\d{1,2})/i) ||
    sceneBlockText.match(/IMAGE:\s*(\d{1,2})_/i);
  const sceneNumber = sceneNumMatch ? parseInt(sceneNumMatch[1], 10) : fallbackIndex;
  const sceneCode = sceneNumber < 10 ? `0${sceneNumber}` : `${sceneNumber}`;

  const imageMatch = sceneBlockText.match(/IMAGE:\s*([^\r\n]+)/i);
  const imageFileName = imageMatch
    ? imageMatch[1].trim()
    : `${sceneCode}_Scene_Frame.png`;
  const sceneTitle = humanizeImageFileName(imageFileName, sceneCode);

  const windowMatch = sceneBlockText.match(
    /SONG EDIT WINDOW:\s*(\d+:\d+(?:\.\d+)?)\s*-\s*(\d+:\d+(?:\.\d+)?)/i
  );
  const startTimeSec = windowMatch ? parseOmniTimestampSec(windowMatch[1]) : (sceneNumber - 1) * 8;
  const endTimeSec = windowMatch ? parseOmniTimestampSec(windowMatch[2]) : startTimeSec + 8;
  const songEditWindow = windowMatch
    ? `${windowMatch[1]} - ${windowMatch[2]}`
    : `${startTimeSec.toFixed(1)} - ${endTimeSec.toFixed(1)}`;

  const durMatch = sceneBlockText.match(/OMNI(?: CLIP)? DURATION:\s*(\d+(?:\.\d+)?)/i);
  const omniDurationSec = durMatch ? parseFloat(durMatch[1]) : 10.0;

  const modeMatch = sceneBlockText.match(/PRIMARY MODE:\s*(NO LIP-SYNC|LIP-SYNC)/i);
  const guideDefaultMode: 'LIP-SYNC' | 'NO LIP-SYNC' =
    modeMatch && /NO LIP-SYNC/i.test(modeMatch[1]) ? 'NO LIP-SYNC' : 'LIP-SYNC';

  // Extract Primary Omni Prompt block
  const primaryMatch = sceneBlockText.match(
    /={4,}\s*COPY THIS INTO OMNI\s*-\s*PRIMARY\s*={4,}\s*([\s\S]*?)\s*={4,}\s*END PRIMARY OMNI PROMPT\s*={4,}/i
  );
  const primaryOmniPrompt = primaryMatch ? primaryMatch[1].trim() : sceneBlockText.trim();

  // Extract Action-Only Omni Prompt block
  const actionMatch = sceneBlockText.match(
    /={4,}\s*COPY THIS INTO OMNI\s*-\s*ACTION ONLY\s*={4,}\s*([\s\S]*?)\s*={4,}\s*END ACTION-ONLY OMNI PROMPT\s*={4,}/i
  );
  const actionOnlyOmniPrompt = actionMatch ? actionMatch[1].trim() : '';

  return buildOmniGuideSceneDataObject({
    sceneNumber,
    sceneCode,
    imageFileName,
    sceneTitle,
    songEditWindow,
    startTimeSec,
    endTimeSec,
    omniDurationSec,
    guideDefaultMode,
    primaryOmniPrompt,
    actionOnlyOmniPrompt,
    rawSetupText: sceneBlockText
  });
}

function buildOmniGuideSceneDataObject(params: {
  sceneNumber: number;
  sceneCode: string;
  imageFileName: string;
  sceneTitle: string;
  songEditWindow: string;
  startTimeSec: number;
  endTimeSec: number;
  omniDurationSec: number;
  guideDefaultMode: 'LIP-SYNC' | 'NO LIP-SYNC';
  primaryOmniPrompt: string;
  actionOnlyOmniPrompt: string;
  rawSetupText: string;
}): OmniHtmlGuideSceneData {
  const {
    sceneNumber,
    sceneCode,
    imageFileName,
    sceneTitle,
    songEditWindow,
    startTimeSec,
    endTimeSec,
    omniDurationSec,
    guideDefaultMode,
    primaryOmniPrompt,
    actionOnlyOmniPrompt,
    rawSetupText
  } = params;

  // Extract BAR-BY-BAR lyric section from primaryOmniPrompt or rawSetupText
  let barByBarLyrics = '';
  const exactBarMatch = primaryOmniPrompt.match(
    /EXACT WORDS TO LIP-SYNC(?:\s*-\s*BAR BY BAR)?:\s*([\s\S]*?)(?:\n\n|\r\n\r\n|REPETITION COUNT:|BAR \/ PHRASE|ACTION TIMELINE:|10-SECOND ACTION TIMELINE:)/i
  );
  if (exactBarMatch) {
    barByBarLyrics = exactBarMatch[1].trim();
  } else {
    const setupBarMatch = rawSetupText.match(/BAR-BY-BAR LYRIC:\s*([\s\S]*?)(?:={4,}|$)/i);
    if (setupBarMatch) {
      barByBarLyrics = setupBarMatch[1].trim();
    }
  }

  const cleanSungLyrics = extractCleanSungLyricsFromBars(barByBarLyrics);

  // Extract PRE-LYRIC, LIP-SYNC, POST-LYRIC windows
  const preMatch = primaryOmniPrompt.match(
    /PRE-LYRIC(?:\s*\/\s*FULL-SCENE)?\s*ACTION WINDOW:\s*([^\r\n]+)/i
  );
  const lipMatch = primaryOmniPrompt.match(/LIP-SYNC WINDOW:\s*([^\r\n]+)/i);
  const postMatch = primaryOmniPrompt.match(/POST-LYRIC(?:\s*ACTION)?\s*WINDOW:\s*([^\r\n]+)/i);

  const preLyricWindow = preMatch ? preMatch[1].trim() : undefined;
  const lipSyncWindow = lipMatch ? lipMatch[1].trim() : undefined;
  const postLyricWindow = postMatch ? postMatch[1].trim() : undefined;

  const parsedPre = parseRelativeWindowSec(preLyricWindow);
  const parsedLip = parseRelativeWindowSec(lipSyncWindow);

  // Extract Action-Only summary paragraph (`PROMPT:\n...`)
  const actionSummaryMatch = actionOnlyOmniPrompt.match(
    /PROMPT:\s*([\s\S]*?)(?:\n\n|\r\n\r\n|NEGATIVE DIRECTION:|$)/i
  );
  const actionOnlySummary = actionSummaryMatch
    ? actionSummaryMatch[1].replace(/\s+/g, ' ').trim()
    : 'No singing. Keep the mouth naturally relaxed and mostly closed with subtle cinematic story motion.';

  const genius = classifySceneEditionWithGeniusIntelligence({
    sceneNumber,
    imageFileName,
    sceneTitle,
    guideDefaultMode,
    cleanSungLyrics,
    primaryOmniPrompt,
    actionOnlyOmniPrompt
  });

  return {
    sceneNumber,
    sceneCode,
    imageFileName,
    sceneTitle,
    songEditWindow,
    startTimeSec,
    endTimeSec,
    omniDurationSec,
    guideDefaultMode,
    barByBarLyrics,
    cleanSungLyrics,
    preLyricWindow,
    lipSyncWindow,
    postLyricWindow,
    preLyricStartSec: parsedPre?.startSec ?? 0,
    lipSyncStartSec: parsedLip?.startSec,
    lipSyncEndSec: parsedLip?.endSec,
    primaryOmniPrompt,
    actionOnlyOmniPrompt,
    actionOnlySummary,
    geniusRecommendedEdition: genius.recommendedEdition,
    geniusSettingCategory: genius.settingCategory,
    geniusReason: genius.reason,
    geniusConfidence: genius.confidence
  };
}

function decodeHtmlEntities(str: string): string {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&bull;/g, '•');
}

/**
 * Parses an Omni Classic HTML Guide (`..._OMNI_Classic_HTML_...html`) or its plain-text equivalent
 * into a structured `OmniHtmlGuideParsedProject` with all 20 scenes, exact edit windows,
 * Primary (Lip-Sync) & Action-Only (Just Animate) prompts, and Genius Contextual Scene Classifications.
 */
export function parseOmniNavigatorHtmlGuide(rawInput: string): OmniHtmlGuideParsedProject | null {
  if (!rawInput || !rawInput.trim()) return null;

  let songTitle = 'Lord I Am Grateful';
  let audioDurationSec = 164.04;
  let audioDurationFormatted = '02:44.04';
  let primaryGrooveBpm = 72.018;
  let doubleTimeBpm = 144.036;
  let meter = '4/4';
  let genreStyle = 'Contemporary Gospel / Worship';
  let musicalStyleLock =
    'Contemporary Gospel / Worship; SLOW-TO-MID felt tempo at 72.018 BPM in 4/4; optional double-time grid 144.036 BPM; warm, soulful, grateful and uplifting.';

  // Extract top-level metadata from HTML or text
  const titleTagMatch = rawInput.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleTagMatch) {
    const rawH1 = decodeHtmlEntities(titleTagMatch[1]).trim();
    songTitle = rawH1.split(/[•—\-]/)[0].trim() || songTitle;
  }

  const durMatch = rawInput.match(
    /AUDIO DURATION:\s*(\d+:\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)\s*seconds\)/i
  );
  if (durMatch) {
    audioDurationFormatted = durMatch[1].trim();
    audioDurationSec = parseFloat(durMatch[2]);
  }

  const bpmMatch = rawInput.match(/(?:PRIMARY \/ FELT GROOVE|TEMPO):\s*(\d+(?:\.\d+)?)\s*BPM/i);
  if (bpmMatch) {
    primaryGrooveBpm = parseFloat(bpmMatch[1]);
    doubleTimeBpm = Math.round(primaryGrooveBpm * 2 * 1000) / 1000;
  }

  const doubleBpmMatch = rawInput.match(
    /DOUBLE-TIME GRID\s*\/\s*ALTERNATE PULSE:\s*(\d+(?:\.\d+)?)\s*BPM/i
  );
  if (doubleBpmMatch) {
    doubleTimeBpm = parseFloat(doubleBpmMatch[1]);
  }

  const genreMatch = rawInput.match(/GENRE\s*\/\s*STYLE:\s*([^\r\n<]+)/i);
  if (genreMatch) {
    genreStyle = decodeHtmlEntities(genreMatch[1]).trim();
  }

  const styleLockMatch = rawInput.match(/MUSICAL STYLE LOCK:\s*([^\r\n<]+)/i);
  if (styleLockMatch) {
    musicalStyleLock = decodeHtmlEntities(styleLockMatch[1]).trim();
  }

  const scenes: OmniHtmlGuideSceneData[] = [];

  // Path 1: Parse `<section class="scene" id="scene-XX">...</section>` HTML blocks
  const sectionRegex = /<section\s+class="scene"\s+id="scene-(\d+)"[^>]*>([\s\S]*?)<\/section>/gi;
  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionRegex.exec(rawInput)) !== null) {
    const sceneNumber = parseInt(sectionMatch[1], 10);
    const sceneCode = sceneNumber < 10 ? `0${sceneNumber}` : `${sceneNumber}`;
    const body = sectionMatch[2];

    const h2Match = body.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    const imageFileName = h2Match
      ? decodeHtmlEntities(h2Match[1]).trim()
      : `${sceneCode}_Scene_Frame.png`;
    const sceneTitle = humanizeImageFileName(imageFileName, sceneCode);

    // Extract all <pre>...</pre> blocks inside this <section>
    // Normally:
    // pre[0] = Scene setup / metadata inside <details>
    // pre[1] = Primary Omni Prompt
    // pre[2] = Action-Only Omni Prompt
    const preBlocks = Array.from(
      body.matchAll(/<(?:pre|textarea)[^>]*>([\s\S]*?)<\/(?:pre|textarea)>/gi)
    ).map((m) => decodeHtmlEntities(m[1]).trim());

    const setupPre = preBlocks.length >= 3 ? preBlocks[0] : body;
    const primaryOmniPrompt =
      preBlocks.length >= 3 ? preBlocks[1] : preBlocks[0] || '';
    const actionOnlyOmniPrompt =
      preBlocks.length >= 3 ? preBlocks[2] : preBlocks[1] || '';

    const winMatch =
      setupPre.match(/SONG EDIT WINDOW:\s*(\d+:\d+(?:\.\d+)?)\s*[-–]\s*(\d+:\d+(?:\.\d+)?)/i) ||
      primaryOmniPrompt.match(
        /SONG EDIT WINDOW:\s*(\d+:\d+(?:\.\d+)?)\s*[-–]\s*(\d+:\d+(?:\.\d+)?)/i
      ) ||
      body.match(/SONG EDIT WINDOW:<\/strong>\s*(\d+:\d+(?:\.\d+)?)\s*[-–]\s*(\d+:\d+(?:\.\d+)?)/i) ||
      body.match(/<div class="meta">(\d+:\d+(?:\.\d+)?)\s*[-–]\s*(\d+:\d+(?:\.\d+)?)/i);

    const startTimeSec = winMatch ? parseOmniTimestampSec(winMatch[1]) : (sceneNumber - 1) * 8;
    const endTimeSec = winMatch ? parseOmniTimestampSec(winMatch[2]) : startTimeSec + 8;
    const songEditWindow = winMatch
      ? `${winMatch[1]} - ${winMatch[2]}`
      : `${startTimeSec.toFixed(1)} - ${endTimeSec.toFixed(1)}`;

    const durMatchScene = setupPre.match(/OMNI CLIP DURATION:\s*(\d+(?:\.\d+)?)/i);
    const omniDurationSec = durMatchScene ? parseFloat(durMatchScene[1]) : 10.0;

    const modeMatch =
      setupPre.match(/PRIMARY MODE:\s*(NO LIP-SYNC|LIP-SYNC)/i) ||
      primaryOmniPrompt.match(/SYNC MODE:\s*(NO LIP-SYNC|LIP-SYNC)/i);
    const guideDefaultMode: 'LIP-SYNC' | 'NO LIP-SYNC' =
      modeMatch && /NO LIP-SYNC/i.test(modeMatch[1]) ? 'NO LIP-SYNC' : 'LIP-SYNC';

    scenes.push(
      buildOmniGuideSceneDataObject({
        sceneNumber,
        sceneCode,
        imageFileName,
        sceneTitle,
        songEditWindow,
        startTimeSec,
        endTimeSec,
        omniDurationSec,
        guideDefaultMode,
        primaryOmniPrompt,
        actionOnlyOmniPrompt,
        rawSetupText: setupPre
      })
    );
  }

  // Path 2: If no `<section class="scene">` tags matched, parse plain-text Omni Board format
  if (scenes.length === 0) {
    let textToParse = rawInput;
    const boardJsonMatch = rawInput.match(/const\s+BOARD\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i);
    if (boardJsonMatch) {
      try {
        const parsedObj = JSON.parse(boardJsonMatch[1]) as { full?: string };
        if (parsedObj.full) {
          textToParse = parsedObj.full;
        }
      } catch {
        // Fallback to rawInput
      }
    }

    const rawSceneSplits = textToParse.split(
      /={20,}\r?\n(?=SCENE\s+\d{1,2}\b)/i
    );
    for (let i = 1; i < rawSceneSplits.length; i++) {
      const parsedScene = parsePlainOmniSceneBlock(rawSceneSplits[i], i);
      if (parsedScene) {
        scenes.push(parsedScene);
      }
    }
  }

  if (scenes.length === 0) {
    return null;
  }

  scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);

  return {
    songTitle,
    audioDurationSec,
    audioDurationFormatted,
    primaryGrooveBpm,
    doubleTimeBpm,
    meter,
    genreStyle,
    musicalStyleLock,
    scenes
  };
}

/**
 * Built-in Canonical 20-Scene Omni Classic HTML Guide Preset for
 * "Lord I Am Grateful" (72.018 BPM / 164.04s) so the user can load or test the full 20-scene
 * Lip-Sync vs Just-Animate Genius Guide with 1 click!
 */
export function getLordIAmGratefulOmniGuidePreset(): OmniHtmlGuideParsedProject {
  const styleLock =
    'Contemporary Gospel / Worship; SLOW-TO-MID felt tempo at 72.018 BPM in 4/4; optional double-time grid 144.036 BPM; warm, soulful, grateful and uplifting. Keep performance natural and unhurried; increase movement only as the song energy rises.';

  const rawDefs: Array<{
    num: number;
    img: string;
    win: string;
    mode: 'LIP-SYNC' | 'NO LIP-SYNC';
    preWin: string;
    lipWin: string;
    postWin: string;
    bars: string;
    timelinePrimary: string;
    actionPrompt: string;
  }> = [
    {
      num: 1,
      img: '01_Golden_Hour_Bedroom_Serenade.png',
      win: '00:00.0 - 00:09.5',
      mode: 'NO LIP-SYNC',
      preWin: '0.0s - 10.0s',
      lipWin: 'NONE',
      postWin: 'NONE',
      bars: '"NONE - instrumental / narrative only"',
      timelinePrimary:
        '0.0s - 10.0s: Begin with the singer seated quietly in the warm bedroom. He takes a slow breath, glances toward the window, lightly rests one hand over his heart, then looks forward with calm anticipation. Keep the mouth relaxed and mostly closed.',
      actionPrompt:
        'The singer rises slowly, walks two or three natural steps toward the window, pauses to take in the morning light, then turns slightly back toward camera. Keep the mouth closed and relaxed.'
    },
    {
      num: 2,
      img: '02_Golden_Walk_Through_The_Neighborhood.png',
      win: '00:09.5 - 00:17.5',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 1.4s',
      lipWin: '1.4s - 6.8s',
      postWin: '6.8s - 10.0s',
      bars: 'BAR 1: "Lord I am grateful"\nPAUSE COMMAND AFTER BAR 1: Follow the natural source-vocal breath/pause.\nBAR 2: "For a refreshing day"',
      timelinePrimary:
        '0.0s - 1.4s PRE-LYRIC: The singer walks naturally toward camera before singing.\n1.4s - 6.8s LIP-SYNC: Perform BAR 1 ("Lord I am grateful") and BAR 2 ("For a refreshing day") with natural breath break.\n6.8s - 10.0s POST-LYRIC: Stop singing immediately after "day" and continue walking with a grateful smile.',
      actionPrompt:
        'Continue the neighborhood story with no singing. He walks past a neighbor, exchanges a friendly nod, briefly touches his chest in gratitude, then looks ahead with a smooth backward tracking shot.'
    },
    {
      num: 3,
      img: '03_Gratitude_In_The_Conference_Room.png',
      win: '00:17.5 - 00:24.7',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 1.3s',
      lipWin: '1.3s - 6.3s',
      postWin: '6.3s - 10.0s',
      bars: 'BAR 1: "So many reasons"\nPAUSE COMMAND AFTER BAR 1: Follow the natural source-vocal breath/pause.\nBAR 2: "I can smile today"',
      timelinePrimary:
        '0.0s - 1.3s PRE-LYRIC: Colleagues review notes around the table.\n1.3s - 6.3s LIP-SYNC: Perform BAR 1 ("So many reasons") and BAR 2 ("I can smile today").\n6.3s - 10.0s POST-LYRIC: Stop singing, gesture warmly to the team.',
      actionPrompt:
        'No singing. Keep all mouths closed or in silent non-speaking reactions. The singer finishes reviewing a page, slides the notebook slightly toward a colleague, receives an appreciative nod, and looks toward the window.'
    },
    {
      num: 4,
      img: '04_Camaraderie_In_The_Office_Break_Area.png',
      win: '00:24.7 - 00:31.8',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 1.2s',
      lipWin: '1.2s - 6.8s',
      postWin: '6.8s - 10.0s',
      bars: 'BAR 1: "I know that I\'m favored"\nPAUSE COMMAND AFTER BAR 1: Follow the natural source-vocal breath/pause.\nBAR 2: "In so many ways"',
      timelinePrimary:
        '0.0s - 1.2s PRE-LYRIC: Warm office break moment holding a mug.\n1.2s - 6.8s LIP-SYNC: Perform BAR 1 ("I know that I\'m favored") and BAR 2 ("In so many ways").\n6.8s - 10.0s POST-LYRIC: Stop singing, lower the mug slightly, and share a warm silent nod.',
      actionPrompt:
        'No singing. Keep the singer and colleagues in silent camaraderie: he lifts his cup slightly, shares a warm nod, listens as a coworker gestures toward a tablet, then smiles calmly.'
    },
    {
      num: 5,
      img: '05_Golden_Hour_Market_Handshake.png',
      win: '00:31.8 - 00:37.1',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 2.4s',
      lipWin: '2.4s - 4.3s',
      postWin: '4.3s - 10.0s',
      bars: 'BAR 1: "I can smile today"',
      timelinePrimary:
        '0.0s - 2.4s PRE-LYRIC: Begin on the handshake in the market.\n2.4s - 4.3s LIP-SYNC: Perform BAR 1 ("I can smile today").\n4.3s - 10.0s POST-LYRIC: Stop singing immediately after "today," release the handshake naturally.',
      actionPrompt:
        'No singing. The singer inspects a piece of fruit, nods appreciatively to the vendor, helps place an item into a bag, then steps slightly aside as the market bustles gently around them.'
    },
    {
      num: 6,
      img: '06_Joyful_Family_Grocery_Unpacking.png',
      win: '00:37.1 - 00:44.4',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 1.2s',
      lipWin: '1.2s - 6.8s',
      postWin: '6.8s - 10.0s',
      bars: 'BAR 1: "I know that I\'m favored"\nPAUSE COMMAND AFTER BAR 1: Follow the natural source-vocal breath/pause.\nBAR 2: "In so many ways"',
      timelinePrimary:
        '0.0s - 1.2s PRE-LYRIC: Family unpacking groceries at the counter.\n1.2s - 6.8s LIP-SYNC: Perform BAR 1 and BAR 2.\n6.8s - 10.0s POST-LYRIC: Stop singing and continue unpacking.',
      actionPrompt:
        'No singing. Keep the family in silent domestic motion: the singer hands fruit to his child, his wife places bread on the counter, and they share warm smiles as sunlight fills the kitchen.'
    },
    {
      num: 7,
      img: '07_Father_Adjusting_Son_School_Backpack.png',
      win: '00:44.4 - 00:53.0',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 2.1s',
      lipWin: '2.1s - 4.0s',
      postWin: '4.0s - 10.0s',
      bars: 'BAR 1: "So I say"',
      timelinePrimary:
        '0.0s - 2.1s PRE-LYRIC: Father kneels to adjust his son\'s backpack straps.\n2.1s - 4.0s LIP-SYNC: Perform BAR 1 ("So I say").\n4.0s - 10.0s POST-LYRIC: Stop singing, pat the boy\'s shoulder.',
      actionPrompt:
        'No singing. The father finishes adjusting the backpack straps, smooths the boy\'s collar, gives an encouraging pat on the shoulder, and watches proudly as his son steps toward the door.'
    },
    {
      num: 8,
      img: '08_Joyful_Family_Dinner_Gathering.png',
      win: '00:53.0 - 01:06.9',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 0.8s',
      lipWin: '0.8s - 7.8s',
      postWin: '7.8s - 10.0s',
      bars: 'BAR 1: "Thank you"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you"\nPAUSE COMMAND AFTER BAR 2: Breath pause.\nBAR 3: "Thank you"\nPAUSE COMMAND AFTER BAR 3: Breath pause.\nBAR 4: "Thank you"',
      timelinePrimary:
        '0.0s - 0.8s PRE-LYRIC: Warm family dinner table.\n0.8s - 7.8s LIP-SYNC: Perform the four "Thank you" bars.\n7.8s - 10.0s POST-LYRIC: Stop singing and pass a serving dish.',
      actionPrompt:
        'No singing. The singer passes a dish across the table, places a warm hand on his child\'s shoulder, shares a grateful look with his partner, and enjoys the peaceful family meal.'
    },
    {
      num: 9,
      img: '09_Heartfelt_Worship_In_Golden_Light.png',
      win: '01:06.9 - 01:14.6',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 0.9s',
      lipWin: '0.9s - 7.0s',
      postWin: '7.0s - 10.0s',
      bars: 'BAR 1: "Lord I am grateful"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "For a refreshing day"',
      timelinePrimary:
        '0.0s - 0.9s PRE-LYRIC: Congregation moves gently; singer raises one hand.\n0.9s - 7.0s LIP-SYNC: Perform BAR 1 ("Lord I am grateful") and BAR 2 ("For a refreshing day").\n7.0s - 10.0s POST-LYRIC: Stop singing and remain in quiet worship.',
      actionPrompt:
        'No singing. The singer closes his eyes, raises both hands slowly, breathes deeply, and holds a reverent posture while nearby worshippers sway and clap softly without visible vocalization.'
    },
    {
      num: 10,
      img: '10_Golden_Hour_Rooftop_Reflection.png',
      win: '01:14.6 - 01:22.5',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 1.3s',
      lipWin: '1.3s - 6.3s',
      postWin: '6.3s - 10.0s',
      bars: 'BAR 1: "So many reasons"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "I can smile today"',
      timelinePrimary:
        '0.0s - 1.3s PRE-LYRIC: Singer looks across the city skyline.\n1.3s - 6.3s LIP-SYNC: Perform BAR 1 ("So many reasons") and BAR 2 ("I can smile today").\n6.3s - 10.0s POST-LYRIC: Rest one hand over heart as camera drifts.',
      actionPrompt:
        'No singing. He looks over the skyline, shifts one hand along the railing, takes a reflective breath, then watches the sunset.'
    },
    {
      num: 11,
      img: '11_Heartfelt_Gospel_On_The_Golden_Porch.png',
      win: '01:22.5 - 01:31.4',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 1.2s',
      lipWin: '1.2s - 6.7s',
      postWin: '6.7s - 10.0s',
      bars: 'BAR 1: "I know that I\'m favored"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "In so many ways"',
      timelinePrimary:
        '0.0s - 1.2s PRE-LYRIC: Quiet porch moment, hand on chest.\n1.2s - 6.7s LIP-SYNC: Perform BAR 1 and BAR 2.\n6.7s - 10.0s POST-LYRIC: Exhale softly and settle into a peaceful smile.',
      actionPrompt:
        'No singing. He shifts forward slightly in the chair, looks toward passing neighborhood life, rubs one thumb gently over his chest, then looks into the distance.'
    },
    {
      num: 12,
      img: '12_Contemplation_On_A_City_Bus.png',
      win: '01:31.4 - 01:37.1',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 2.2s',
      lipWin: '2.2s - 4.1s',
      postWin: '4.1s - 10.0s',
      bars: 'BAR 1: "So I say"',
      timelinePrimary:
        '0.0s - 2.2s PRE-LYRIC: Watching the city through the bus window.\n2.2s - 4.1s LIP-SYNC: Perform BAR 1 ("So I say").\n4.1s - 10.0s POST-LYRIC: Return gaze to the bus window.',
      actionPrompt:
        'No singing. Keep him looking through the bus window as the city passes. He follows something outside with his eyes, lightly adjusts his posture, and rests one hand near the window frame.'
    },
    {
      num: 13,
      img: '13_Mentorship_In_A_Modern_Office.png',
      win: '01:37.1 - 01:44.7',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 1.0s',
      lipWin: '1.0s - 5.8s',
      postWin: '5.8s - 10.0s',
      bars: 'BAR 1: "Thank you"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you"',
      timelinePrimary:
        '0.0s - 1.0s PRE-LYRIC: Points at laptop with younger colleague.\n1.0s - 5.8s LIP-SYNC: Perform BAR 1 and BAR 2 ("Thank you").\n5.8s - 10.0s POST-LYRIC: Give a reassuring nod.',
      actionPrompt:
        'No singing. The singer demonstrates something on the laptop, points to a detail, lets the younger colleague take over, then gives an encouraging nod and steps slightly back.'
    },
    {
      num: 14,
      img: '14_Golden_Hour_Grocery_Gift.png',
      win: '01:44.7 - 01:52.4',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 1.1s',
      lipWin: '1.1s - 5.8s',
      postWin: '5.8s - 10.0s',
      bars: 'BAR 1: "Thank you"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you"',
      timelinePrimary:
        '0.0s - 1.1s PRE-LYRIC: Open on the doorstep grocery handoff.\n1.1s - 5.8s LIP-SYNC: Perform BAR 1 and BAR 2.\n5.8s - 10.0s POST-LYRIC: Release the bag carefully with a respectful nod.',
      actionPrompt:
        'No singing. He supports the grocery bag as the woman takes it, gestures gently toward the items, shares a respectful smile, then steps back from the doorway as she nods gratefully.'
    },
    {
      num: 15,
      img: '15_Community_Meal_Distribution_Day.png',
      win: '01:52.4 - 02:00.0',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 0.8s',
      lipWin: '0.8s - 7.0s',
      postWin: '7.0s - 10.0s',
      bars: 'BAR 1: "Thank you"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you"\nPAUSE COMMAND AFTER BAR 2: Breath pause.\nBAR 3: "Thank you"',
      timelinePrimary:
        '0.0s - 0.8s PRE-LYRIC: Receiving a meal container from a volunteer.\n0.8s - 7.0s LIP-SYNC: Perform BAR 1, BAR 2, BAR 3 ("Thank you").\n7.0s - 10.0s POST-LYRIC: Hand over the meal with a warm silent smile.',
      actionPrompt:
        'No singing. The singer hands one meal to a recipient, reaches for another container, helps organize the serving table, and gestures for the next person in line to step forward.'
    },
    {
      num: 16,
      img: '16_Golden_Hour_Courtyard_Celebration.png',
      win: '02:00.0 - 02:08.3',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 0.8s',
      lipWin: '0.8s - 7.6s',
      postWin: '7.6s - 10.0s',
      bars: 'BAR 1: "Thank you for your favor"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you for your kindness"',
      timelinePrimary:
        '0.0s - 0.8s PRE-LYRIC: Courtyard group claps and moves.\n0.8s - 7.6s LIP-SYNC: Perform BAR 1 ("Thank you for your favor") and BAR 2 ("Thank you for your kindness").\n7.6s - 10.0s POST-LYRIC: Continue clapping silently and lift one hand in gratitude.',
      actionPrompt:
        'No singing. The singer claps with the circle, turns toward different people, steps lightly with the rhythm, raises one hand in gratitude, and lets the courtyard celebration continue naturally.'
    },
    {
      num: 17,
      img: '17_Heartfelt_Worship_Band_Performance.png',
      win: '02:08.3 - 02:16.6',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 0.7s',
      lipWin: '0.7s - 7.7s',
      postWin: '7.7s - 10.0s',
      bars: 'BAR 1: "Thank you for your goodness"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you for your favor"',
      timelinePrimary:
        '0.0s - 0.7s PRE-LYRIC: Band plays, singer inhales and raises free hand.\n0.7s - 7.7s LIP-SYNC: Perform BAR 1 ("Thank you for your goodness") and BAR 2 ("Thank you for your favor").\n7.7s - 10.0s POST-LYRIC: Lower microphone slightly and sway in worship.',
      actionPrompt:
        'No singing. Keep the band moving musically while the singer lowers the microphone, closes his eyes, raises one hand, takes a deep breath, and sways gently as musicians continue playing.'
    },
    {
      num: 18,
      img: '18_Family_Candlelit_Prayer_Circle.png',
      win: '02:16.6 - 02:25.0',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 0.9s',
      lipWin: '0.9s - 7.7s',
      postWin: '7.7s - 10.0s',
      bars: 'BAR 1: "Thank you for your kindness"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you for your goodness"',
      timelinePrimary:
        '0.0s - 0.9s PRE-LYRIC: Family bowed in prayer.\n0.9s - 7.7s LIP-SYNC: Perform BAR 1 and BAR 2 softly.\n7.7s - 10.0s POST-LYRIC: Remain still with eyes closed by candlelight.',
      actionPrompt:
        'No singing. The family holds hands quietly. The singer bows his head, breathes deeply, gives a gentle reassuring squeeze to the hands beside him, and remains still as candles flicker.'
    },
    {
      num: 19,
      img: '19_Golden_Hour_Gospel_Celebration.png',
      win: '02:25.0 - 02:33.0',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 0.6s',
      lipWin: '0.6s - 8.0s',
      postWin: '8.0s - 10.0s',
      bars: 'BAR 1: "Thank you"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you"\nPAUSE COMMAND AFTER BAR 2: Breath pause.\nBAR 3: "Thank you"\nPAUSE COMMAND AFTER BAR 3: Breath pause.\nBAR 4: "Thank you"',
      timelinePrimary:
        '0.0s - 0.6s PRE-LYRIC: Crowd moving and clapping.\n0.6s - 8.0s LIP-SYNC: Perform all four "Thank you" bars with joyous energy.\n8.0s - 10.0s POST-LYRIC: Raise both hands as the crowd celebrates.',
      actionPrompt:
        'No singing. The singer claps with the crowd, steps lightly to the rhythm, turns toward friends, raises both hands, and joins the celebration while the camera arcs slowly around the group.'
    },
    {
      num: 20,
      img: '20_Grateful_Heart_Over_The_City.png',
      win: '02:33.0 - 02:43.0',
      mode: 'LIP-SYNC',
      preWin: '0.0s - 0.8s',
      lipWin: '0.8s - 7.4s',
      postWin: '7.4s - 10.0s',
      bars: 'BAR 1: "Thank you"\nPAUSE COMMAND AFTER BAR 1: Breath pause.\nBAR 2: "Thank you"\nPAUSE COMMAND AFTER BAR 2: Breath pause.\nBAR 3: "Thank you"',
      timelinePrimary:
        '0.0s - 0.8s PRE-LYRIC: Quiet breath above the city, hand over heart.\n0.8s - 7.4s LIP-SYNC: Perform the closing three "Thank you" bars.\n7.4s - 10.0s POST-LYRIC: Look back over the city and hold a peaceful final expression as camera pulls away.',
      actionPrompt:
        'No singing. The singer stands quietly above the city, hand over heart, turns toward the sunset, breathes deeply, then rests both hands on the railing as the camera slowly pulls back for the final resolution.'
    }
  ];

  const scenes: OmniHtmlGuideSceneData[] = rawDefs.map((d) => {
    const sceneCode = d.num < 10 ? `0${d.num}` : `${d.num}`;
    const [w0, w1] = d.win.split('-').map((s) => s.trim());
    const startTimeSec = parseOmniTimestampSec(w0);
    const endTimeSec = parseOmniTimestampSec(w1);

    const primaryOmniPrompt = [
      `SCENE: ${sceneCode}`,
      `OMNI DURATION: 10 seconds`,
      `SONG EDIT WINDOW: ${d.win}`,
      `TEMPO: 72.018 BPM`,
      `METER: 4/4`,
      `MUSICAL STYLE LOCK: ${styleLock}`,
      `SYNC MODE: ${d.mode}`,
      ``,
      `PRE-LYRIC ACTION WINDOW: ${d.preWin}`,
      `LIP-SYNC WINDOW: ${d.lipWin}`,
      `POST-LYRIC ACTION WINDOW: ${d.postWin}`,
      ``,
      `EXACT WORDS TO LIP-SYNC - BAR BY BAR:`,
      d.bars,
      ``,
      `10-SECOND ACTION TIMELINE:`,
      d.timelinePrimary,
      ``,
      `NO ON-SCREEN TEXT:`,
      `No subtitles, captions, visible lyrics, titles, logos or watermarks - video must contain ZERO visible text.`
    ].join('\n');

    const actionOnlyOmniPrompt = [
      `NO ON-SCREEN TEXT:`,
      `No subtitles, captions, visible lyrics, titles, logos or watermarks - video must contain ZERO visible text.`,
      ``,
      `SCENE: ${sceneCode}A`,
      `OMNI DURATION: 10 seconds`,
      `TEMPO: 72.018 BPM`,
      `METER: 4/4`,
      `MUSICAL STYLE LOCK: ${styleLock}`,
      `SYNC MODE: NO LIP-SYNC`,
      ``,
      `EXACT WORDS TO LIP-SYNC:`,
      `"NONE - action-only continuation"`,
      ``,
      `ABSOLUTE RULE:`,
      `NO SINGING. NO LIP-SYNC. NO DIALOGUE. Keep the mouth naturally relaxed and mostly closed.`,
      ``,
      `PROMPT:`,
      `${d.actionPrompt} Continue the same storyline, identity, wardrobe logic, location and emotional tone as the matching storyboard scene. Use subtle environmental motion and musically compatible camera pacing.`,
      ``,
      `NEGATIVE DIRECTION:`,
      `- No singing.`,
      `- No lip-sync.`,
      `- No dialogue.`,
      `- No subtitles, captions, visible lyrics, titles, logos or watermarks.`
    ].join('\n');

    return buildOmniGuideSceneDataObject({
      sceneNumber: d.num,
      sceneCode,
      imageFileName: d.img,
      sceneTitle: humanizeImageFileName(d.img, sceneCode),
      songEditWindow: d.win,
      startTimeSec,
      endTimeSec,
      omniDurationSec: 10.0,
      guideDefaultMode: d.mode,
      primaryOmniPrompt,
      actionOnlyOmniPrompt,
      rawSetupText: ''
    });
  });

  return {
    songTitle: 'Lord I Am Grateful',
    audioDurationSec: 164.04,
    audioDurationFormatted: '02:44.04',
    primaryGrooveBpm: 72.018,
    doubleTimeBpm: 144.036,
    meter: '4/4',
    genreStyle: 'Contemporary Gospel / Worship',
    musicalStyleLock: styleLock,
    scenes
  };
}
