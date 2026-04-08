// ────────────────────────────────────────────
// Screen Capture
//
// Captures the current Pane surface as a
// base64 image. Used for agent visual feedback.
// ────────────────────────────────────────────

import html2canvas from 'html2canvas'
import { TIMEOUT_SCREEN_CAPTURE } from '@pane/core'

export interface CaptureOptions {
  selector?: string        // CSS selector for the element to capture (default: view area)
  scale?: number           // Resolution scale (default: 1, use 0.5 for smaller images)
  quality?: number         // JPEG quality 0-1 (default: 0.8)
  format?: 'png' | 'jpeg'
  timeout?: number         // Max ms to wait for html2canvas (default: 5000)
}

export async function capturePane(options: CaptureOptions = {}): Promise<string> {
  const {
    selector = '[data-pane-view]',
    scale = 1,
    quality = 0.8,
    format = 'jpeg',
    timeout = TIMEOUT_SCREEN_CAPTURE,
  } = options

  // Find the element to capture
  let element = document.querySelector(selector) as HTMLElement
  if (!element) {
    // Fallback to the root pane element
    element = document.querySelector('[data-pane-root]') as HTMLElement
  }
  if (!element) {
    // Last resort — capture the body
    element = document.body
  }

  // Race html2canvas against a timeout to prevent hangs on complex views
  const capturePromise = html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: null,
    logging: false,
  })

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`capturePane timed out after ${timeout}ms`)), timeout)
  )

  const canvas = await Promise.race([capturePromise, timeoutPromise])

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  return canvas.toDataURL(mimeType, quality)
}

// Convert data URL to just the base64 part (for API calls)
export function dataUrlToBase64(dataUrl: string): { base64: string; mediaType: string } {
  const [header, base64] = dataUrl.split(',')
  const mediaType = header.match(/data:(.*?);/)?.[1] ?? 'image/jpeg'
  return { base64, mediaType }
}
