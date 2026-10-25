import JSZip from 'jszip';
import {
  StoryboardDirectorProject,
  StoryboardDirectorScene,
  SongDnaProfile,
  FeltTempoClass,
  StoryboardSceneType,
  CameraMotionPreset
} from '../types';

const STORAGE_PROJECT_KEY = 'lipsyncer_storyboard_project_v1';

export function classifyFeltTempoClass(bpm: number): FeltTempoClass {
  if (bpm < 70) return 'SLOW';
  if (bpm < 90) return 'SLOW-TO-MID';
  if (bpm < 120) return 'MID-TEMPO';
  if (bpm < 150) return 'UP-TEMPO';
  return 'HIGH/FAST';
}

export function formatTimeWindow(startSec: number, endSec: number): string {
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    const padSec = parseFloat(sec) < 10 ? `0${sec}` : sec;
    return `${m < 10 ? '0' : ''}${m}:${padSec}`;
  };
  return `${fmt(startSec)} - ${fmt(endSec)}`;
}

export function buildSongDnaProfile(params: {
  songTitle: string;
  artistName: string;
  durationSec: number;
  detectedBpm?: number;
  lyrics?: string;
  genreStyle?: string;
  songCharacter?: string;
}): SongDnaProfile {
  const durationSec = Math.max(15, params.durationSec || 180);
  const primaryGrooveBpm = Math.round(params.detectedBpm && params.detectedBpm > 40 ? params.detectedBpm : 96);
  const feltTempoClass = classifyFeltTempoClass(primaryGrooveBpm);

  let alternateGridBpm: number | null = null;
  let alternateGridType: 'DOUBLE-TIME' | 'HALF-TIME' | 'NONE' = 'NONE';
  if (primaryGrooveBpm < 85) {
    alternateGridBpm = primaryGrooveBpm * 2;
    alternateGridType = 'DOUBLE-TIME';
  } else if (primaryGrooveBpm > 135) {
    alternateGridBpm = Math.round(primaryGrooveBpm / 2);
    alternateGridType = 'HALF-TIME';
  }

  const beatLengthSec = +(60 / primaryGrooveBpm).toFixed(3);
  const barLength44Sec = +(beatLengthSec * 4).toFixed(3);
  const tenSecondOmniBarCapacity = +(10 / barLength44Sec).toFixed(1);

  const lyricsLower = (params.lyrics || '').toLowerCase();
  const titleLower = params.songTitle.toLowerCase();
  const isGospel =
    lyricsLower.includes('lord') ||
    lyricsLower.includes('grace') ||
    lyricsLower.includes('jesus') ||
    lyricsLower.includes('praise') ||
    titleLower.includes('favor') ||
    titleLower.includes('glory');

  const genreStyle =
    params.genreStyle ||
    (isGospel ? 'Contemporary Gospel / Soulful Worship' : 'Cinematic Pop / Emotional Narrative');

  const songCharacter =
    params.songCharacter ||
    (isGospel
      ? 'Reverent, deeply grateful, soul-stirring vocal crescendo with warm spiritual resonance'
      : 'Passionate, emotionally charged narrative with anthemic vocal delivery');

  const energyArc =
    'Intro (intimate atmosphere) -> Verse 1 (story unfolding) -> Chorus 1 (vocal lift) -> Verse 2 (emotional depth) -> Bridge (dramatic peak) -> Final Chorus (triumphant climax) -> Outro (peaceful resolution)';

  const performanceFeel =
    feltTempoClass === 'SLOW' || feltTempoClass === 'SLOW-TO-MID'
      ? 'Unrushed, heartfelt emotional sway, genuine micro-expressions, natural eye closures on sustained vocal notes'
      : 'Dynamic physical rhythm, confident cadence, rhythmic shoulder & head accents on downbeats';

  const cameraFeel =
    'Cooke S4/i prime lenses, slow tracking pushes on emotional revelations, gentle handheld arcs during musical lifts, creamy stage light bokeh';

  const altPulseDesc =
    alternateGridBpm && alternateGridType !== 'NONE'
      ? `; optional ${alternateGridType.toLowerCase()} grid ${alternateGridBpm} BPM`
      : '';

  const musicalStyleLockLine = `MUSICAL STYLE LOCK: ${genreStyle}; ${feltTempoClass} felt tempo at ${primaryGrooveBpm} BPM in 4/4${altPulseDesc}; ${performanceFeel}. Use original song audio as final phoneme timing authority.`;

  const m = Math.floor(durationSec / 60);
  const s = Math.round(durationSec % 60);
  const audioDurationFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;

  return {
    songTitle: params.songTitle || 'Untitled Master',
    artistName: params.artistName || 'Featured Artist',
    audioDurationSec: durationSec,
    audioDurationFormatted,
    genreStyle,
    songCharacter,
    feltTempoClass,
    primaryGrooveBpm,
    alternateGridBpm,
    alternateGridType,
    meter: '4/4',
    beatLengthSec,
    barLength44Sec,
    tenSecondOmniBarCapacity,
    energyArc,
    performanceFeel,
    cameraFeel,
    expertTempoInterpretation: `Lock performance groove to ${primaryGrooveBpm} BPM. Original song audio is the final syllable timing authority.`,
    musicalStyleLockLine
  };
}

export function parseLyricsIntoVerses(rawLyrics: string): string[] {
  if (!rawLyrics || !rawLyrics.trim()) {
    return [
      'I will praise your name forever',
      'Through every valley and every trial',
      'Your goodness follows me every day',
      'Standing strong in faith and joy',
      'With grateful heart I lift my voice',
      'Forever and ever more'
    ];
  }
  return rawLyrics
    .split(/\r?\n/)
    .map((l) => l.replace(/\[\d{2}:\d{2}\.\d{2}\]/g, '').trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));
}

export function generateTwentyScenePlan(params: {
  songTitle: string;
  artistName: string;
  durationSec: number;
  lyrics: string;
  genderLock?: 'auto' | 'female' | 'male' | 'duo_group';
  modestyPreset?: 'sacred_gospel' | 'contemporary_stage' | 'casual_studio';
  artistDescription?: string;
  detectedBpm?: number;
}): StoryboardDirectorProject {
  const songDna = buildSongDnaProfile({
    songTitle: params.songTitle,
    artistName: params.artistName,
    durationSec: params.durationSec,
    detectedBpm: params.detectedBpm,
    lyrics: params.lyrics
  });

  const lyricLines = parseLyricsIntoVerses(params.lyrics);
  const totalDuration = songDna.audioDurationSec;
  const sceneDuration = totalDuration / 20;

  const narrativeRoles = [
    { num: 1, role: 'Introduction / Solitary Stillness', type: 'NO LIP-SYNC' as const, shot: 'Establishing Wide', cam: 'slow_pan' as CameraMotionPreset },
    { num: 2, role: 'World & Environment Establishing', type: 'NO LIP-SYNC' as const, shot: 'Atmospheric Medium', cam: 'drone_pull_back' as CameraMotionPreset },
    { num: 3, role: 'Lead Artist Close Look', type: 'LIP-SYNC' as const, shot: 'Intimate Close-up', cam: 'push_in' as CameraMotionPreset },
    { num: 4, role: 'Verse 1 Opening Delivery', type: 'LIP-SYNC' as const, shot: 'Medium Bust Portrait', cam: 'handheld_cinema' as CameraMotionPreset },
    { num: 5, role: 'Daily Life / Community B-Roll', type: 'NO LIP-SYNC' as const, shot: 'Narrative Environmental', cam: 'slow_pan' as CameraMotionPreset },
    { num: 6, role: 'Emotional Reflection', type: 'LIP-SYNC' as const, shot: 'Medium Close-up', cam: 'orbital_spin' as CameraMotionPreset },
    { num: 7, role: 'Instrumental Transition', type: 'NO LIP-SYNC' as const, shot: 'Cinematic B-Roll', cam: 'slow_pan' as CameraMotionPreset },
    { num: 8, role: 'First Chorus Vocal Rise', type: 'LIP-SYNC' as const, shot: 'Passionate Close-up', cam: 'push_in' as CameraMotionPreset },
    { num: 9, role: 'Chorus Anthem Climax', type: 'LIP-SYNC' as const, shot: 'Stage Wide with Spotlight', cam: 'drone_pull_back' as CameraMotionPreset },
    { num: 10, role: 'Folder A Emotional Crest', type: 'LIP-SYNC' as const, shot: 'Dynamic Headshot', cam: 'handheld_cinema' as CameraMotionPreset },
    { num: 11, role: 'Second Movement World Expansion', type: 'NO LIP-SYNC' as const, shot: 'Cinematic Landscape', cam: 'drone_pull_back' as CameraMotionPreset },
    { num: 12, role: 'Verse 2 Intimate Storyline', type: 'LIP-SYNC' as const, shot: 'Medium Over-the-Shoulder', cam: 'handheld_cinema' as CameraMotionPreset },
    { num: 13, role: 'Supporting Human Relationships', type: 'NO LIP-SYNC' as const, shot: 'Warm Group Interaction', cam: 'slow_pan' as CameraMotionPreset },
    { num: 14, role: 'Inner Revelation / Turning Point', type: 'LIP-SYNC' as const, shot: 'Soulful Close-up', cam: 'push_in' as CameraMotionPreset },
    { num: 15, role: 'Bridge Escalation', type: 'LIP-SYNC' as const, shot: 'Dramatic Bust Shot', cam: 'orbital_spin' as CameraMotionPreset },
    { num: 16, role: 'Vocal Crescendo Lift', type: 'LIP-SYNC' as const, shot: 'High-Angle Emotional', cam: 'push_in' as CameraMotionPreset },
    { num: 17, role: 'Orchestral / Beat Climax Peak', type: 'NO LIP-SYNC' as const, shot: 'Volumetric Stage Reveal', cam: 'drone_pull_back' as CameraMotionPreset },
    { num: 18, role: 'Final Chorus Triumphant Power', type: 'LIP-SYNC' as const, shot: 'Master Close-up Singing', cam: 'handheld_cinema' as CameraMotionPreset },
    { num: 19, role: 'Anthemic Vocal Hold & Peace', type: 'LIP-SYNC' as const, shot: 'Sunset Rim-lit Portrait', cam: 'slow_pan' as CameraMotionPreset },
    { num: 20, role: 'Closing Resolution & Fade', type: 'NO LIP-SYNC' as const, shot: 'Serene Closing Tableau', cam: 'drone_pull_back' as CameraMotionPreset }
  ];

  let lyricIndex = 0;
  const scenes: StoryboardDirectorScene[] = narrativeRoles.map((item, idx) => {
    const sceneNumber = item.num;
    const sceneCode = sceneNumber < 10 ? `0${sceneNumber}` : `${sceneNumber}`;
    const folderBatch: 'A' | 'B' = sceneNumber <= 10 ? 'A' : 'B';
    const timeStartSec = +(idx * sceneDuration).toFixed(1);
    const timeEndSec = +(Math.min(totalDuration, (idx + 1) * sceneDuration)).toFixed(1);
    const songWindowFormatted = formatTimeWindow(timeStartSec, timeEndSec);

    const isLipSync = item.type === 'LIP-SYNC';
    let exactLyrics = 'NONE - instrumental / narrative';
    let repetitionCount = 1;

    if (isLipSync) {
      if (lyricLines.length > 0) {
        exactLyrics = lyricLines[lyricIndex % lyricLines.length];
        lyricIndex++;
      } else {
        exactLyrics = `${params.songTitle} chorus line`;
      }
    }

    const shortName = `${item.role.split('/')[0].trim()}`;
    const imageFilename = `${sceneCode}_${shortName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`;

    const cleanTitle = params.songTitle || 'The Song';
    const artist = params.artistName || 'The Artist';

    const genderText = params.genderLock === 'male' ? 'male vocalist in tailored blazer suit' : 'female vocalist in elegant modest gown';
    const dignityText = 'fully clothed, high coverage neckline, dignified stage attire, zero bare chest, zero exposed torso.';

    const imagePrompt = `Scene ${sceneCode}: ${item.shot} of ${artist} (${genderText}) on a warm cinematic live performance stage during "${cleanTitle}". ${dignityText} Microscopic natural skin pores, realistic subtle skin sheen, catchlights in the eyes, real stage microphone, Cooke S4/i prime lens shallow depth of field, creamy bokeh. Photorealistic 4K natural human cinema photography on ARRI Alexa Mini LF, real skin texture, consistent facial identity and natural body proportions, ZERO visible text, no lyrics, no subtitles, no captions, no logos, no watermarks.`;

    const primaryPromptBody = isLipSync
      ? `BAR 1: Vocalist begins articulating the assigned lyric "${exactLyrics}".\nPAUSE: Hold expressive eye contact and breath cadence on sustained notes.\nORIGINAL SONG AUDIO is final syllable/phoneme timing authority. Stop mouth movement immediately when assigned words end.\n${item.cam === 'push_in' ? 'Slow cinematic push-in' : 'Subtle steady camera tracking'} on the vocalist. Authentic emotional head tilt and gentle natural chest breathing in sync with the performance.`
      : `Instrumental narrative section. Performer's mouth is naturally relaxed and completely closed. NO SINGING, NO DIALOGUE, NO LIP-SYNC. Camera performs a majestic ${item.cam.replace('_', ' ')} capturing atmospheric stage light beams and emotional contemplation.`;

    const primaryOmniPrompt = `SCENE: ${sceneCode}
SONG WINDOW: ${songWindowFormatted}
TEMPO: ${songDna.primaryGrooveBpm} BPM
METER: 4/4
SYNC MODE: ${item.type}

${songDna.musicalStyleLockLine}

EXACT WORDS TO LIP-SYNC:
"${exactLyrics}"
REPETITION COUNT: ${repetitionCount}

PROMPT:
${primaryPromptBody}

NO ON-SCREEN TEXT:
No subtitles, captions, visible lyrics, titles, logos or watermarks - video must contain ZERO visible text.`;

    const actionOnlyOmniPrompt = `SCENE: ${sceneCode}A
SONG WINDOW: ${songWindowFormatted} (action-only continuation or alternate cut)
TEMPO: ${songDna.primaryGrooveBpm} BPM
METER: 4/4
SYNC MODE: NO LIP-SYNC

${songDna.musicalStyleLockLine}

EXACT WORDS TO LIP-SYNC:
"NONE - action only continuation"

PROMPT:
Continue the scene naturally with body action, posture shift, facial reaction, and subtle camera motion only. Performer mouth remains naturally closed. NO SINGING. NO LIP-SYNC. NO DIALOGUE. Camera maintains ${item.cam.replace('_', ' ')} through the stage lighting beams.

NO ON-SCREEN TEXT:
No subtitles, captions, visible lyrics, titles, logos or watermarks - video must contain ZERO visible text.`;

    return {
      sceneNumber,
      sceneCode,
      folderBatch,
      shortName,
      imageFilename,
      narrativeArcRole: item.role,
      timeStartSec,
      timeEndSec,
      songWindowFormatted,
      syncMode: item.type,
      sceneType: item.type as StoryboardSceneType,
      exactLyrics,
      repetitionCount,
      shotType: item.shot,
      cameraMovement: item.cam,
      cameraDirectionText: `Smooth ${item.cam.replace('_', ' ')} camera motion on 50mm cinema prime`,
      subjectActionText: isLipSync ? `Articulating "${exactLyrics}"` : 'Reflective posture',
      environmentMotionText: 'Warm volumetric stage lighting beams and ambient dust motes',
      emotionalTone: item.role,
      transitionNote: idx < 19 ? `Seamless match-cut into Scene ${idx + 2}` : 'Gentle fade to black',
      imagePrompt,
      primaryOmniPrompt,
      actionOnlyOmniPrompt,
      selectedModelId: isLipSync ? 'ltx-2-5-audio' : 'lipsyncer-dsp-60fps',
      done: false,
      notes: ''
    };
  });

  const project: StoryboardDirectorProject = {
    id: `sb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    songTitle: params.songTitle || 'Untitled Music Video',
    artistName: params.artistName || 'Featured Artist',
    artistDescription: params.artistDescription || '',
    genderLock: params.genderLock || 'auto',
    modestyPreset: params.modestyPreset || 'sacred_gospel',
    rawLyrics: params.lyrics || '',
    songDna,
    scenes,
    updatedAt: Date.now()
  };

  saveStoryboardProject(project);
  return project;
}

export function saveStoryboardProject(project: StoryboardDirectorProject): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PROJECT_KEY, JSON.stringify(project));
  } catch (err) {
    console.warn('Failed to save storyboard project to localStorage:', err);
  }
}

export function loadStoryboardProject(): StoryboardDirectorProject | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_PROJECT_KEY);
    return raw ? (JSON.parse(raw) as StoryboardDirectorProject) : null;
  } catch {
    return null;
  }
}

export function buildCanonicalOmniBoardTxt(
  project: StoryboardDirectorProject,
  batchMode: 'FULL' | 'FOLDER_B' = 'FULL'
): string {
  const filteredScenes =
    batchMode === 'FOLDER_B'
      ? project.scenes.filter((s) => s.folderBatch === 'B')
      : project.scenes;

  const titleHeader = `============================================================
${project.songTitle.toUpperCase()}
MUSIC VIDEO FLOW / OMNI VIDEO BOARD
EXACT LIP-SYNC + BPM LOCK EDITION
============================================================

SONG DNA / MUSICAL PROFILE - EXPERT AUDIO ANALYSIS
GENRE / STYLE: ${project.songDna.genreStyle}
SONG CHARACTER: ${project.songDna.songCharacter}
FELT TEMPO CLASS: ${project.songDna.feltTempoClass}
PRIMARY / FELT GROOVE: ${project.songDna.primaryGrooveBpm} BPM
DOUBLE-TIME / HALF-TIME GRID: ${project.songDna.alternateGridBpm ? `${project.songDna.alternateGridBpm} BPM (${project.songDna.alternateGridType})` : 'NONE'}
METER: ${project.songDna.meter}
BEAT LENGTH: ${project.songDna.beatLengthSec}s
4/4 BAR LENGTH: ${project.songDna.barLength44Sec}s
10-SECOND OMNI CAPACITY: ${project.songDna.tenSecondOmniBarCapacity} bars
ENERGY ARC: ${project.songDna.energyArc}
PERFORMANCE FEEL: ${project.songDna.performanceFeel}
CAMERA FEEL: ${project.songDna.cameraFeel}
EXPERT TEMPO INTERPRETATION: ${project.songDna.expertTempoInterpretation}

IMPORTANT NEW SYNC RULES:
- BPM controls groove, walking cadence, body micro-movement, and camera rhythm.
- The ORIGINAL SONG AUDIO is the final authority for exact syllable and phoneme timing.
- Never write lyrics or captions visibly on storyboard images.
- Every scene provides an isolated PRIMARY OMNI PROMPT and an ACTION-ONLY continuation prompt.
- NO ON-SCREEN TEXT: No subtitles, captions, visible lyrics, titles, logos or watermarks - video must contain ZERO visible text.
`;

  const sceneBlocks = filteredScenes.map((scene) => {
    return `============================================================
SCENE ${scene.sceneCode} - ${scene.shortName.toUpperCase()}
IMAGE: ${scene.imageFilename}
SONG EDIT WINDOW: ${scene.songWindowFormatted}
PRIMARY MODE: ${scene.syncMode}
NARRATIVE ARC: ${scene.narrativeArcRole}
EXACT WORDS TO LIP-SYNC: ${scene.exactLyrics}
REPETITION COUNT: ${scene.repetitionCount}

========== COPY THIS INTO OMNI - PRIMARY ==========
${scene.primaryOmniPrompt}
========== END PRIMARY OMNI PROMPT ==========

========== COPY THIS INTO OMNI - ACTION ONLY ==========
${scene.actionOnlyOmniPrompt}
========== END ACTION-ONLY OMNI PROMPT ==========

TRANSITION: ${scene.transitionNote}
`;
  });

  return `${titleHeader}\n${sceneBlocks.join('\n')}`;
}

export function buildLegacySimpleNavigatorHtml(canonicalTxt: string, songTitle: string): string {
  const safeTitle = songTitle.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle} - Omni Navigator</title>
<style>
:root{--bg:#0b0f14;--top:#0a0e13;--panel:#111722;--text:#f5f7fb;--muted:#a4aec0;--line:#293447;--accent:#8bd7ff;--amber:#ffc84a;--button:#1c2638;--code:#0d1320}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;line-height:1.6}
header{position:sticky;top:0;background:rgba(10,14,19,.96);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:14px 20px;display:flex;justify-content:space-between;align-items:center}
h1{font-size:1.4rem;margin:0}button{background:var(--button);color:var(--text);border:1px solid var(--line);padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer}
button:hover{border-color:var(--accent)}main{max-width:1200px;margin:24px auto;padding:0 20px}pre{background:var(--code);border:1px solid var(--line);padding:16px;border-radius:10px;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.5}
.kicker{color:var(--amber);font-size:12px;font-weight:800;letter-spacing:1px}
</style>
</head>
<body>
<header>
  <div><div class="kicker">OMNI NAVIGATOR</div><h1>${safeTitle}</h1></div>
  <div><button onclick="window.print()">Print / Save PDF</button></div>
</header>
<main>
  <div class="kicker">CANONICAL FLOW / OMNI TXT BOARD</div>
  <pre id="board">${canonicalTxt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</main>
</body>
</html>`;
}

export function buildSmartProductionConsoleHtml(canonicalTxt: string, songTitle: string): string {
  const safeTitle = songTitle.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle} - Omni Production Console</title>
<style>
:root{--bg:#0b0d12;--panel:#121620;--panel2:#171c28;--text:#edf1f7;--muted:#9ca8b8;--line:#273041;--accent:#8fd3ff;--ok:#91e6a7}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;line-height:1.6}
header{position:sticky;top:0;background:rgba(11,13,18,.96);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
button{background:#20283a;color:var(--text);border:1px solid var(--line);padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer}
button:hover{border-color:var(--accent)}main{max-width:1300px;margin:24px auto;padding:0 24px}pre{background:#0a0e14;border:1px solid var(--line);padding:16px;border-radius:10px;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.5}
.badge{background:#151a24;border:1px solid var(--line);padding:4px 10px;border-radius:99px;font-size:12px;color:var(--ok)}
</style>
</head>
<body>
<header>
  <div><span class="badge">SMART CONSOLE</span> <strong style="margin-left:8px;font-size:1.1rem">${safeTitle}</strong></div>
  <div><button onclick="copyAll()">Copy Full Board</button> <button onclick="window.print()">Print / Save PDF</button></div>
</header>
<main>
  <pre id="raw">${canonicalTxt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</main>
<script>
function copyAll(){
  navigator.clipboard.writeText(document.getElementById('raw').innerText);
  alert('Copied full canonical board to clipboard!');
}
</script>
</body>
</html>`;
}

export async function packageFolderAZip(project: StoryboardDirectorProject): Promise<Blob> {
  const zip = new JSZip();
  const folderA = zip.folder(`${project.songTitle.replace(/[^a-z0-9]+/gi, '_')}_Folder_A_Images_01_10`);

  const canonicalTxt = buildCanonicalOmniBoardTxt(project, 'FULL');
  folderA?.file(`${project.songTitle.replace(/[^a-z0-9]+/gi, '_')}_Music_Video_Flow_Exact_LipSync_Omni.txt`, canonicalTxt);

  const legacyHtml = buildLegacySimpleNavigatorHtml(canonicalTxt, project.songTitle);
  folderA?.file(`${project.songTitle.replace(/[^a-z0-9]+/gi, '_')}_OMNI_Navigator.html`, legacyHtml);

  const consoleHtml = buildSmartProductionConsoleHtml(canonicalTxt, project.songTitle);
  folderA?.file(`${project.songTitle.replace(/[^a-z0-9]+/gi, '_')}_OMNI_Production_Console.html`, consoleHtml);

  const scenes01to10 = project.scenes.filter((s) => s.folderBatch === 'A');
  for (const scene of scenes01to10) {
    if (scene.generatedImageUrl && scene.generatedImageUrl.startsWith('data:image')) {
      const b64 = scene.generatedImageUrl.split(',')[1];
      folderA?.file(scene.imageFilename, b64, { base64: true });
    } else {
      folderA?.file(`${scene.sceneCode}_prompt_and_metadata.txt`, `${scene.imagePrompt}\n\n${scene.primaryOmniPrompt}`);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

export async function packageFolderBZip(project: StoryboardDirectorProject): Promise<Blob> {
  const zip = new JSZip();
  const folderB = zip.folder(`${project.songTitle.replace(/[^a-z0-9]+/gi, '_')}_Folder_B_Images_11_20`);

  const companionTxt = buildCanonicalOmniBoardTxt(project, 'FOLDER_B');
  folderB?.file(`${project.songTitle.replace(/[^a-z0-9]+/gi, '_')}_Folder_B_Flow_Exact_LipSync_Omni.txt`, companionTxt);

  const scenes11to20 = project.scenes.filter((s) => s.folderBatch === 'B');
  for (const scene of scenes11to20) {
    if (scene.generatedImageUrl && scene.generatedImageUrl.startsWith('data:image')) {
      const b64 = scene.generatedImageUrl.split(',')[1];
      folderB?.file(scene.imageFilename, b64, { base64: true });
    } else {
      folderB?.file(`${scene.sceneCode}_prompt_and_metadata.txt`, `${scene.imagePrompt}\n\n${scene.primaryOmniPrompt}`);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

export async function transcribeAudioWithBrowserWhisper(
  audioFileOrBlob: File | Blob,
  onStatus?: (msg: string) => void
): Promise<string> {
  onStatus?.('Initializing browser Whisper WebAssembly AI worker...');
  const arrayBuffer = await audioFileOrBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate: 16000 });
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const float32 = audioBuffer.getChannelData(0);
  try {
    await ctx.close();
  } catch {}

  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker('/ai-worker.js', { type: 'module' });
    } catch {
      resolve('');
      return;
    }

    const handler = (e: MessageEvent) => {
      const data = e.data || {};
      if (data.status === 'progress' && data.data && onStatus) {
        onStatus(`Whisper model loading: ${Math.round(data.data.progress || 0)}%`);
      } else if (data.status === 'transcribing' && onStatus) {
        onStatus('Transcribing vocal performance in browser...');
      } else if (data.status === 'complete') {
        worker.removeEventListener('message', handler);
        worker.terminate();
        resolve(data.result || '');
      } else if (data.status === 'error') {
        worker.removeEventListener('message', handler);
        worker.terminate();
        reject(new Error(data.error || 'Whisper worker transcription error'));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ audio: float32 });
  });
}
