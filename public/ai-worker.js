import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;
const MODEL_NAME = 'Xenova/whisper-tiny.en';

class PipelineSingleton {
  static task = 'automatic-speech-recognition';
  static model = MODEL_NAME;
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

function formatLRC(chunks) {
  let lrcText = '';
  if (!Array.isArray(chunks)) return lrcText;
  for (const chunk of chunks) {
    if (!chunk || !chunk.timestamp) continue;
    const startTime = typeof chunk.timestamp === 'number' ? chunk.timestamp : chunk.timestamp[0];
    if (startTime === undefined || startTime === null) continue;
    const minutes = Math.floor(startTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(startTime % 60).toString().padStart(2, '0');
    const hundredths = Math.floor((startTime % 1) * 100).toString().padStart(2, '0');
    const text = (chunk.text || '').trim();
    if (text) {
      lrcText += `[${minutes}:${seconds}.${hundredths}] ${text}\n`;
    }
  }
  return lrcText;
}

self.addEventListener('message', async (event) => {
  const { audio } = event.data || {};
  if (!audio) {
    self.postMessage({ status: 'error', error: 'No audio data provided' });
    return;
  }
  try {
    const transcriber = await PipelineSingleton.getInstance((progressData) => {
      self.postMessage({ status: 'progress', data: progressData });
    });
    self.postMessage({ status: 'transcribing' });
    const output = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true
    });
    const lrcText = formatLRC(output.chunks);
    self.postMessage({
      status: 'complete',
      result: lrcText,
      chunks: output.chunks
    });
  } catch (error) {
    self.postMessage({
      status: 'error',
      error: error && error.message ? error.message : String(error)
    });
  }
});
