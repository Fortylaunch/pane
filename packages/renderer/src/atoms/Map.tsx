import { useMemo, type CSSProperties } from 'react'

interface MapMarker {
  position: [number, number]
  label?: string
  color?: string
}

interface MapLayer {
  type: 'circle'
  center: [number, number]
  radius: number
  color?: string
  opacity?: number
}

interface MapProps {
  center: [number, number]
  zoom?: number
  markers?: MapMarker[]
  layers?: MapLayer[]
  tileUrl?: string
  height?: string
  width?: string
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function buildMapHtml(props: MapProps): string {
  const {
    center,
    zoom = 10,
    markers = [],
    layers = [],
    tileUrl = DARK_TILES,
  } = props

  const markersJs = markers.map(m => {
    const color = m.color ?? '#3b82f6'
    const icon = `L.divIcon({
      className: '',
      html: '<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 6px ${color}"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    })`
    const popup = m.label ? `.bindPopup('${m.label.replace(/'/g, "\\'")}')` : ''
    return `L.marker([${m.position[0]}, ${m.position[1]}], { icon: ${icon} }).addTo(map)${popup};`
  }).join('\n')

  const layersJs = layers.map(l => {
    if (l.type === 'circle') {
      return `L.circle([${l.center[0]}, ${l.center[1]}], { radius: ${l.radius}, color: '${l.color ?? '#3b82f6'}', fillOpacity: ${l.opacity ?? 0.2}, weight: 1 }).addTo(map);`
    }
    return ''
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${LEAFLET_CSS}" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0a0a0a; }
    .leaflet-control-attribution { font-size: 9px !important; background: rgba(0,0,0,0.6) !important; color: #666 !important; }
    .leaflet-control-attribution a { color: #888 !important; }
    .leaflet-control-zoom a { background: rgba(24,24,27,0.85) !important; color: #fafafa !important; border-color: rgba(255,255,255,0.08) !important; }
    .leaflet-popup-content-wrapper { background: rgba(24,24,27,0.9); color: #fafafa; border-radius: 8px; font-family: -apple-system, sans-serif; font-size: 12px; }
    .leaflet-popup-tip { background: rgba(24,24,27,0.9); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="${LEAFLET_JS}"><\/script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${center[0]}, ${center[1]}], ${zoom});
    L.tileLayer('${tileUrl}', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    ${markersJs}
    ${layersJs}
  <\/script>
</body>
</html>`
}

export function Map(props: MapProps) {
  const {
    height = '400px',
    width = '100%',
    style,
    className,
  } = props

  const html = useMemo(() => buildMapHtml(props), [
    props.center?.[0], props.center?.[1], props.zoom,
    JSON.stringify(props.markers), JSON.stringify(props.layers), props.tileUrl,
  ])

  return (
    <iframe
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      className={className}
      style={{
        width,
        height,
        border: '1px solid var(--pane-color-border)',
        borderRadius: 'var(--pane-radius-lg)',
        background: '#0a0a0a',
        ...style,
      }}
    />
  )
}
