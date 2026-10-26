import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const BASE_URL = 'https://lipsyncer.web.app';
const TODAY = new Date().toISOString().split('T')[0];

const CANONICAL_ROUTES = [
  {
    route: '/',
    priority: '1.0',
    changefreq: 'weekly',
    title: 'LipSyncer AI — Multi-Model Video & Image Lip-Sync Studio + Omni Music Video Director',
    description:
      'Lip-sync any video or portrait image with audio using Creatify Aurora, OpenArt Lip Sync, Kling Avatar, Kling Lipsync V1, Byte Plus Omni Human 1.5, Hedra (fast), LTX 2.5, ByteDance LatentSync 1.5, Seedance 2.0, Kling 3.0, PixVerse, Wan 2.7, Veo 3.1, and 20-Scene Storyboard Director.',
    heading: 'Multi-Model AI Lip-Sync & Music Video Production Studio',
    bodyHtml: `
      <p>LipSyncer AI is an OpenArt-class multi-model lip-sync studio supporting both <strong>Video + Audio neural mouth re-synchronization</strong> and <strong>Portrait Image + Audio talking and singing video generation</strong>. Choose across 19 specialized models including the full OpenArt official suite (Creatify Aurora, OpenArt Lip Sync, Kling Avatar, Kling Lipsync V1, Byte Plus Omni Human 1.5, Hedra fast) plus LTX 2.5 Audio-to-Video, ByteDance LatentSync 1.5, Seedance 2.0 Mini, Kling 3.0 Omni, PixVerse C1 &amp; V6, HappyHorse 1.1, Alibaba Wan 2.7, Veo 3.1 4K, and our instant 60fps browser vocal formant viseme engine.</p>
      <p>Direct full-length songs with our integrated <strong>20-Scene Music Video Storyboard &amp; Omni Production Director</strong> featuring Expert Song DNA BPM/Groove analysis, exact lyric-to-time lip-sync locks, zero visible on-screen text enforcement, Folder A &amp; Folder B ZIP packaging, and Dual Offline HTML Navigators.</p>
    `
  },
  {
    route: '/models/',
    priority: '0.9',
    changefreq: 'weekly',
    title: 'AI Lip-Sync Models Directory — OpenArt Lip Sync, Creatify Aurora, Kling Avatar, Kling Lipsync V1, Byte Plus, Hedra, LTX 2.5 | LipSyncer',
    description:
      'Compare 19 audio-to-video and video-to-audio AI lip-sync models side-by-side: Creatify Aurora, OpenArt Lip Sync, Kling Avatar, Kling Lipsync V1, Byte Plus Omni Human 1.5, Hedra (fast), LTX 2.5, LatentSync 1.5, Seedance 2.0 Mini, Kling 3.0 Omni, PixVerse V6, HappyHorse 1.1, Wan 2.7, and Veo 3.1.',
    heading: 'Supported AI Lip-Sync & Audio-to-Video Models',
    bodyHtml: `
      <p>Explore and filter LipSyncer AI models by provider (OpenArt, Creatify, Kling AI, ByteDance, Hedra, Lightricks, PixVerse, HappyHorse, Alibaba Wan, Google DeepMind, LipSyncer DSP), resolution (480p to 4K), frame control (Start/End frames, multimodal reference), and input media (Video + Audio or Portrait + Audio).</p>
    `
  },
  {
    route: '/storyboard-director/',
    priority: '0.9',
    changefreq: 'weekly',
    title: '20-Scene Music Video Storyboard & Omni Lip-Sync Director | LipSyncer AI',
    description:
      'Turn any uploaded song and lyrics into a coherent 20-scene cinematic music video storyboard with Expert Song DNA BPM analysis, Folder A/B ZIPs, and Dual Standalone Omni HTML Consoles.',
    heading: '20-Scene Cinematic Music Video Storyboard & Exact Lip-Sync Director',
    bodyHtml: `
      <p>Analyze Song DNA (Genre, Felt Tempo Class, Primary Groove BPM, Double-Time Grid, Meter, Energy Arc) and plan 20 chronological music video frames across Folder A (Scenes 01–10) and Folder B (Scenes 11–20) with exact lyric-to-time lip-sync instructions, Primary &amp; Action-Only Omni copy blocks, and standalone offline HTML consoles.</p>
    `
  },
  {
    route: '/arena/',
    priority: '0.8',
    changefreq: 'weekly',
    title: 'Lip-Sync Model Arena — Side-by-Side AI Video & Audio Benchmark | LipSyncer AI',
    description:
      'Benchmark two AI lip-sync models head-to-head on the exact same portrait or video and vocal clip. Compare phoneme accuracy, facial realism, and motion coherence.',
    heading: 'AI Lip-Sync Model Arena & Leaderboard',
    bodyHtml: `
      <p>Run head-to-head blind and side-by-side comparisons across LTX 2.5 Audio-to-Video, ByteDance LatentSync 1.5, Seedance 2.0 Mini, Kling 3.0 Omni, Wan 2.7, and LipSyncer 60fps DSP Instant.</p>
    `
  },
  {
    route: '/how-to-use/',
    priority: '0.7',
    changefreq: 'monthly',
    title: 'How to Lip-Sync Videos & Portraits with AI — Step-by-Step Guide | LipSyncer AI',
    description:
      'Complete production guide to Video+Audio lip-syncing, Portrait+Audio singing generation, sample-accurate WAV trimming, and 20-scene Omni music video directing.',
    heading: 'How to Use LipSyncer AI Studio',
    bodyHtml: `
      <p>Learn how to upload or record clean vocal audio, slice exact chorus windows, select the optimal model for speaking vs singing, manage multi-account ZeroGPU tokens, and export 1080p H.264 MP4 masters.</p>
    `
  },
  {
    route: '/about/',
    priority: '0.6',
    changefreq: 'monthly',
    title: 'About LipSyncer AI — Multimodal Lip-Sync & Music Video Studio',
    description:
      'Learn about LipSyncer AI architecture, natural-human cinematography standards, and multi-model audio-to-video synchronization technology.',
    heading: 'About LipSyncer AI Studio',
    bodyHtml: `
      <p>LipSyncer AI empowers filmmakers, musicians, and digital storytellers with studio-grade vocal synchronization, natural human realism, and browser-native Web Audio DSP precision.</p>
    `
  },
  {
    route: '/privacy/',
    priority: '0.6',
    changefreq: 'monthly',
    title: 'Privacy Policy | LipSyncer AI Studio',
    description:
      'Read how LipSyncer AI safeguards creator portraits, vocal recordings, local IndexedDB vaults, and encrypted cloud sessions.',
    heading: 'Privacy Policy',
    bodyHtml: `
      <p>LipSyncer AI follows a local-first creator privacy architecture using browser IndexedDB binary storage, local WebAssembly Whisper transcription, and SHA-256 encrypted account vaults.</p>
    `
  },
  {
    route: '/terms/',
    priority: '0.6',
    changefreq: 'monthly',
    title: 'Terms of Service | LipSyncer AI Studio',
    description:
      'Terms of Service, creator ownership rights, and ethical likeness guidelines for LipSyncer AI Studio.',
    heading: 'Terms of Service',
    bodyHtml: `
      <p>Creators retain rights to original works produced with authorized portraits, footage, and vocal recordings while adhering to ethical consent and likeness standards.</p>
    `
  }
];

function runSsg() {
  const templatePath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error('dist/index.html not found. Run vite build before build-ssg.js');
  }
  const baseHtml = fs.readFileSync(templatePath, 'utf-8');

  for (const page of CANONICAL_ROUTES) {
    const canonicalUrl = `${BASE_URL}${page.route}`;
    let html = baseHtml
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${page.title}</title>`)
      .replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${page.description}" />`
      )
      .replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
        `<link rel="canonical" href="${canonicalUrl}" />`
      )
      .replace(
        /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:title" content="${page.title}" />`
      )
      .replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:description" content="${page.description}" />`
      )
      .replace(
        /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:url" content="${canonicalUrl}" />`
      );

    // Inject crawlable semantic <main> fallback inside #root (replaced cleanly when React mounts)
    const semanticShell = `<div id="root"><main style="max-width:960px;margin:0 auto;padding:48px 24px;color:#e4e4e7;font-family:Inter,system-ui,sans-serif"><header><h1 style="font-size:2rem;font-weight:800;margin-bottom:16px">${page.heading}</h1></header><section style="line-height:1.7;color:#a1a1aa">${page.bodyHtml}</section><footer style="margin-top:40px;padding-top:20px;border-top:1px solid #27272a;font-size:0.85rem"><nav style="display:flex;gap:16px;flex-wrap:wrap"><a href="/" style="color:#a78bfa">Studio</a><a href="/models/" style="color:#a78bfa">Models</a><a href="/storyboard-director/" style="color:#a78bfa">20-Scene Director</a><a href="/arena/" style="color:#a78bfa">Model Arena</a><a href="/how-to-use/" style="color:#a78bfa">How to Use</a><a href="/about/" style="color:#a78bfa">About</a><a href="/privacy/" style="color:#a78bfa">Privacy</a><a href="/terms/" style="color:#a78bfa">Terms</a></nav></footer></main></div>`;

    html = html.replace('<div id="root"></div>', semanticShell);

    const outDir = page.route === '/' ? DIST_DIR : path.join(DIST_DIR, page.route);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');
  }

  // Generate sitemap.xml
  const sitemapEntries = CANONICAL_ROUTES.map(
    (p) => `  <url>
    <loc>${BASE_URL}${p.route}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  ).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf-8');

  // Generate robots.txt
  const robotsTxt = `User-agent: *
Allow: /

User-agent: Googlebot-Image
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt, 'utf-8');

  console.log(`[SSG] Generated ${CANONICAL_ROUTES.length} static routes, sitemap.xml, and robots.txt for ${BASE_URL}`);
}

runSsg();
