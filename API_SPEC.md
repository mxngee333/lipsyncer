# LIPSYNCER — External & Relay API Specification (OpenAPI 3.1)
**Elder 3 (Hermes) · Wave 1 Integration & Protocol Contract**

---

## 1. Protocol Matrix Overview

LIPSYNCER communicates directly from the browser (and via optional Coolify SOCKS5 Relay failover) across four protocol families:
1. **Gradio v4/v5 ZeroGPU Queue & SSE API** (`https://<space-subdomain>.hf.space/gradio_api/...`)
2. **Coolify / Hetzner SOCKS5 Video Relay API** (`https://relay.modelissa.com` / `VITE_RELAY_URL`)
3. **AI Director & Keyframe Synthesis APIs** (SiliconFlow OpenAI-compatible REST & Zhipu GLM v4 REST)
4. **Cloudflare R2 S3-Compatible Presigned Object API** (`https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}`)

---

## 2. OpenAPI 3.1.0 Specification

```yaml
openapi: 3.1.0
info:
  title: LIPSYNCER Multi-Model Inference, Director & R2 Vault API Contract
  version: 1.0.0
  description: >
    Unified OpenAPI 3.1 contract covering Gradio ZeroGPU SSE endpoints,
    Coolify SOCKS5 Relay endpoints, SiliconFlow/Zhipu LLM & Keyframe endpoints,
    and Cloudflare R2 AWS Signature V4 presigned PUT/GET operations.

servers:
  - url: https://multimodalart-ltx2-audio-to-video.hf.space
    description: LTX 2.5 Audio-to-Video ZeroGPU Space
  - url: https://fffiloni-latentsync.hf.space
    description: ByteDance LatentSync 1.5 ZeroGPU Space
  - url: https://multimodalart-minimax-h3-audio-to-video.hf.space
    description: Seedance 2.0 Mini / HappyHorse 1.1 ZeroGPU Space
  - url: https://r3gm-wan2-2-fp8da-aoti-preview2.hf.space
    description: Wan 2.7 Start/End Dual-Frame ZeroGPU Space
  - url: https://klingteam-liveportrait.hf.space
    description: Kling 3.0 Omni LivePortrait Retargeting Space
  - url: https://sczhou-codeformer.hf.space
    description: Veo 3.1 Stage-1 CodeFormer Macro Face Restoration Space
  - url: https://relay.modelissa.com
    description: Coolify / Hetzner SOCKS5 Multi-Engine Video Relay
  - url: https://api.siliconflow.cn/v1
    description: SiliconFlow FLUX.1-schnell & Qwen/DeepSeek Director API
  - url: https://open.bigmodel.cn/api/paas/v4
    description: Zhipu AI GLM-4-Plus & CogView-3 Director API
  - url: https://{accountId}.r2.cloudflarestorage.com
    description: Cloudflare R2 S3-Compatible Object Vault
    variables:
      accountId:
        default: your_r2_account_id

components:
  securitySchemes:
    HFTokenBearer:
      type: http
      scheme: bearer
      description: Rotating Hugging Face token (hf_*) from hfTokenPoolService
    ProviderApiKey:
      type: http
      scheme: bearer
      description: VITE_SILICONFLOW_API_KEY or VITE_GLM_API_KEY
    AwsSigV4Query:
      type: apiKey
      in: query
      name: X-Amz-Signature
      description: Browser Web Crypto HMAC-SHA256 AWS Signature V4 presigned query parameters

  schemas:
    GradioFileData:
      type: object
      required: [path]
      properties:
        path:
          type: string
          description: Server-side uploaded temp path or public URL
        url:
          type: string
          format: uri
        orig_name:
          type: string
        mime_type:
          type: string
        meta:
          type: object
          properties:
            _type:
              type: string
              const: gradio.FileData

    GradioEventTicket:
      type: object
      required: [event_id]
      properties:
        event_id:
          type: string
          example: "eb91f20c4a8d4e119b8a"

    RelayVideoResponse:
      type: object
      required: [ok, videoUrl]
      properties:
        ok:
          type: boolean
        videoUrl:
          type: string
          format: uri
        durationSec:
          type: number
        proxyExitNode:
          type: string
        elapsedMs:
          type: integer

paths:
  # ==========================================================================
  # 1. GRADIO ZEROGPU ENDPOINTS (Queue Join + SSE Result Stream)
  # ==========================================================================
  /gradio_api/upload:
    post:
      summary: Upload binary image, video, or audio stem to target Hugging Face Space
      security:
        - HFTokenBearer: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                files:
                  type: array
                  items:
                    type: string
                    format: binary
      responses:
        "200":
          description: Array of temporary Space file paths
          content:
            application/json:
              schema:
                type: array
                items:
                  type: string

  /gradio_api/call/get_audio_duration:
    post:
      summary: Probe exact stem duration on LTX 2.5 Space prior to video synthesis
      security:
        - HFTokenBearer: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data:
                  type: array
                  prefixItems:
                    - $ref: "#/components/schemas/GradioFileData"
      responses:
        "200":
          description: Queue event ticket (consume via GET /gradio_api/call/get_audio_duration/{event_id})
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GradioEventTicket"

  /gradio_api/call/generate:
    post:
      summary: >
        Enqueue audio-driven video generation on LTX 2.5 (multimodalart/ltx2-audio-to-video)
        or Seedance 2.0 Mini / HappyHorse 1.1 (multimodalart/minimax-h3-audio-to-video)
      security:
        - HFTokenBearer: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data:
                  type: array
                  description: >
                    Ordered positional tuple:
                    [prompt, first_frame_file_or_null, audio_file, duration_sec,
                     height, width, guidance_scale, seed, randomize_seed]
      responses:
        "200":
          description: Returns Gradio event_id for SSE stream consumption
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GradioEventTicket"
        "429":
          description: ZeroGPU quota exhausted — triggers hfTokenPoolService rotation

  /gradio_api/call/generate/{event_id}:
    get:
      summary: SSE stream emitting heartbeat, progress, complete, or error events
      security:
        - HFTokenBearer: []
      parameters:
        - name: event_id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: >
            text/event-stream emitting `event: complete` with JSON array containing output MP4 GradioFileData
          content:
            text/event-stream:
              schema:
                type: string

  /gradio_api/call/generate_lip_sync_video:
    post:
      summary: ByteDance LatentSync 1.5 audio-conditioned UNet lip-sync video endpoint
      security:
        - HFTokenBearer: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data:
                  type: array
                  description: "[video_input_file, audio_input_file, guidance_scale, inference_steps, seed]"
      responses:
        "200":
          description: Event ticket for GET /gradio_api/call/generate_lip_sync_video/{event_id}
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GradioEventTicket"

  /gradio_api/call/generate_video:
    post:
      summary: >
        Wan 2.7 FP8 Dual-Frame (Start + End keyframe interpolation) or LivePortrait expression retargeting
      security:
        - HFTokenBearer: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data:
                  type: array
                  description: "[start_image, end_image, prompt, negative_prompt, duration_sec, steps, guidance_scale, seed]"
      responses:
        "200":
          description: Event ticket for GET /gradio_api/call/generate_video/{event_id}
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GradioEventTicket"

  # ==========================================================================
  # 2. COOLIFY / HETZNER SOCKS5 RELAY ENDPOINTS (VITE_RELAY_URL)
  # ==========================================================================
  /health:
    get:
      summary: Health & SOCKS5 pool readiness check for Coolify Relay
      responses:
        "200":
          description: Relay online
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    const: ok
                  socksPoolActive:
                    type: integer
                  uptimeSec:
                    type: number

  /api/ltx-audio-video:
    post:
      summary: Relay-proxied LTX 2.5 / Seedance / PixVerse / HappyHorse audio-to-video synthesis
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [audio, prompt]
              properties:
                image:
                  type: string
                  format: binary
                audio:
                  type: string
                  format: binary
                prompt:
                  type: string
                modelVariant:
                  type: string
                  enum: [ltx-2-5-audio, seedance-2-mini, pixverse-c1, pixverse-v6, happyhorse-1-1, happyhorse-1-0]
                aspectRatio:
                  type: string
                  enum: ["16:9", "9:16", "1:1"]
                durationSec:
                  type: number
                hfToken:
                  type: string
      responses:
        "200":
          description: Synthesized MP4 URL or binary stream
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/RelayVideoResponse"

  /api/wan-video:
    post:
      summary: Relay-proxied Wan 2.7 Start/End Dual-Frame + Audio mux synthesis
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [startImage, prompt]
              properties:
                startImage:
                  type: string
                  format: binary
                endImage:
                  type: string
                  format: binary
                audio:
                  type: string
                  format: binary
                prompt:
                  type: string
                negativePrompt:
                  type: string
                durationSec:
                  type: number
      responses:
        "200":
          description: Synthesized Dual-Frame MP4 response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/RelayVideoResponse"

  # ==========================================================================
  # 3. SILICONFLOW & ZHIPU GLM DIRECTOR + KEYFRAME ENDPOINTS
  # ==========================================================================
  /chat/completions:
    post:
      summary: >
        Synthesize Expert Song DNA & 20-Scene Dual Omni Storyboard JSON
        (Zhipu glm-4-plus / SiliconFlow Qwen2.5-72B-Instruct)
      security:
        - ProviderApiKey: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [model, messages]
              properties:
                model:
                  type: string
                  examples: ["glm-4-plus", "glm-4-flash", "Qwen/Qwen2.5-72B-Instruct"]
                temperature:
                  type: number
                  default: 0.4
                response_format:
                  type: object
                  properties:
                    type:
                      type: string
                      const: json_object
                messages:
                  type: array
                  items:
                    type: object
                    required: [role, content]
                    properties:
                      role:
                        type: string
                        enum: [system, user, assistant]
                      content:
                        type: string
      responses:
        "200":
          description: Structured SongDNA + 20 StoryboardScene JSON completion

  /images/generations:
    post:
      summary: >
        Generate Zero-Text 16:9 / 9:16 Start & End Keyframes for Folder A
        (SiliconFlow black-forest-labs/FLUX.1-schnell or Zhipu cogview-3-plus)
      security:
        - ProviderApiKey: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [model, prompt]
              properties:
                model:
                  type: string
                  examples: ["black-forest-labs/FLUX.1-schnell", "cogview-3-plus", "cogview-3-flash"]
                prompt:
                  type: string
                negative_prompt:
                  type: string
                image_size:
                  type: string
                  examples: ["1024x576", "576x1024", "1024x1024", "1344x768"]
                num_inference_steps:
                  type: integer
                  default: 4
      responses:
        "200":
          description: Generated keyframe URL (immediately fetched into IndexedDB Blob)

  # ==========================================================================
  # 4. CLOUDFLARE R2 AWS SIGNATURE V4 PRESIGNED OPERATIONS
  # ==========================================================================
  /{bucket}/auth/users/{sha256}.json:
    parameters:
      - name: bucket
        in: path
        required: true
        schema:
          type: string
          example: lipsyncer
      - name: sha256
        in: path
        required: true
        schema:
          type: string
          pattern: "^[a-f0-9]{64}$"
    get:
      summary: Fetch user vault JSON during Sign In or duplicate check
      security:
        - AwsSigV4Query: []
      responses:
        "200":
          description: R2UserVaultRecord JSON document
        "404":
          description: Account does not exist
    put:
      summary: Write or update R2UserVaultRecord JSON
      security:
        - AwsSigV4Query: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        "200":
          description: Stored successfully

  /{bucket}/users/{uid}/videos/{id}.mp4:
    parameters:
      - name: bucket
        in: path
        required: true
        schema:
          type: string
      - name: uid
        in: path
        required: true
        schema:
          type: string
      - name: id
        in: path
        required: true
        schema:
          type: string
    put:
      summary: Upload rendered lip-sync MP4 binary via SigV4 presigned URL
      security:
        - AwsSigV4Query: []
      requestBody:
        required: true
        content:
          video/mp4:
            schema:
              type: string
              format: binary
      responses:
        "200":
          description: MP4 committed to R2 Vault
    get:
      summary: Presigned private read fallback when public R2 CDN domain is not configured
      security:
        - AwsSigV4Query: []
      responses:
        "200":
          description: MP4 binary stream
```

---

## 3. ZeroGPU Quota Detection & Failover Protocol

When consuming Gradio SSE streams (`event: error` or HTTP `429`/`503`), `hfTokenPoolService` matches message strings against:
```regex
/(exceeded your GPU quota|ZeroGPU quota|rate limit|Too Many Requests|Sign-in is required|Space is asleep)/i
```
1. On match, the active `hf_*` token is stamped with `cooldownUntilMs = Date.now() + 900_000` (15 minutes) and persisted to `lipsyncer_hf_token_pool_v1`.
2. The request transparently retries with the next healthy token in the pool (up to `min(pool.length, 4)` attempts).
3. If every token in the pool is on cooldown and `VITE_RELAY_URL` is reachable (`GET /health` -> `200`), execution seamlessly routes to `/api/ltx-audio-video` or `/api/wan-video`.
