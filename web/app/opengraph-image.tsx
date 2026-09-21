import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: 80,
          backgroundColor: '#101828',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: 96,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#f59e0b',
            marginBottom: 32,
          }}
        />
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
          Construction Photo Log
        </div>
        <div style={{ fontSize: 32, marginTop: 24, color: '#cbd5e1' }}>
          Photo documentation for construction sites
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
