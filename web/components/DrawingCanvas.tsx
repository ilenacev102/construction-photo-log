'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Circle, MapPin, MoveRight, Pen, Square, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { usePins } from '@/hooks/usePins'
import { useRole } from '@/hooks/useRole'
import type { PinType } from '@/types/database'

interface DrawingCanvasProps {
  photoId: string
  imageUrl: string
}

const DEFAULT_DRAW_COLOR = '#ef4444'

const TOOLS: { type: PinType; icon: LucideIcon; a11yKey: string }[] = [
  { type: 'pin', icon: MapPin, a11yKey: 'pin' },
  { type: 'arrow', icon: MoveRight, a11yKey: 'arrow' },
  { type: 'rectangle', icon: Square, a11yKey: 'rect' },
  { type: 'circle', icon: Circle, a11yKey: 'circle' },
  { type: 'freehand', icon: Pen, a11yKey: 'pen' },
  { type: 'text', icon: Type, a11yKey: 'text' },
]

export default function DrawingCanvas({ photoId, imageUrl }: DrawingCanvasProps) {
  const t = useTranslations('drawingCanvas')
  const { pins, isLoading, addPin, removePin } = usePins(photoId)
  const { canWrite } = useRole()
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeTool, setActiveTool] = useState<PinType>('pin')
  const [activeColor, setActiveColor] = useState(DEFAULT_DRAW_COLOR)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [draftPath, setDraftPath] = useState<string>('')
  const [textInput, setTextInput] = useState({ show: false, x: 0, y: 0, value: '' })
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)

  function getRelativePos(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!canWrite) return
    e.preventDefault()
    const pos = getRelativePos(e.clientX, e.clientY)
    setDrawing(true)
    setStartPos(pos)
    setCurrentPos(pos)

    if (activeTool === 'text') {
      setTextInput({ show: true, x: pos.x, y: pos.y, value: '' })
      setDrawing(false)
    }
    if (activeTool === 'pin') {
      addPin({ pin_type: 'pin', x: pos.x, y: pos.y, color: activeColor })
    }
  }, [activeTool, activeColor, canWrite, addPin])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing || !canWrite) return
    const pos = getRelativePos(e.clientX, e.clientY)
    setCurrentPos(pos)

    if (activeTool === 'freehand') {
      setDraftPath((prev) => `${prev} ${pos.x},${pos.y}`)
    }
  }, [drawing, activeTool, canWrite])

  const handlePointerUp = useCallback(() => {
    if (!drawing || !canWrite) return
    setDrawing(false)

    if (activeTool === 'arrow') {
      addPin({
        pin_type: 'arrow',
        x: startPos.x,
        y: startPos.y,
        width: currentPos.x - startPos.x,
        height: currentPos.y - startPos.y,
        color: activeColor,
        drawing_data: { endX: currentPos.x, endY: currentPos.y },
      })
      setDraftPath('')
    }

    if (activeTool === 'rectangle' || activeTool === 'circle') {
      addPin({
        pin_type: activeTool,
        x: Math.min(startPos.x, currentPos.x),
        y: Math.min(startPos.y, currentPos.y),
        width: Math.abs(currentPos.x - startPos.x),
        height: Math.abs(currentPos.y - startPos.y),
        color: activeColor,
      })
      setDraftPath('')
    }

    if (activeTool === 'freehand' && draftPath) {
      addPin({
        pin_type: 'freehand',
        x: startPos.x,
        y: startPos.y,
        color: activeColor,
        drawing_data: { path: draftPath },
      })
      setDraftPath('')
    }
  }, [drawing, activeTool, startPos, currentPos, draftPath, activeColor, addPin, canWrite])

  const handleTextSubmit = useCallback(() => {
    if (textInput.value.trim()) {
      addPin({
        pin_type: 'text',
        x: textInput.x,
        y: textInput.y,
        color: activeColor,
        label: textInput.value,
      })
    }
    setTextInput({ show: false, x: 0, y: 0, value: '' })
  }, [textInput, activeColor, addPin])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-6 animate-spin rounded-full border-4 border-border border-t-foreground" />
      </div>
    )
  }

  if (!pins) return null

  return (
    <div className="space-y-3">
      {/* Glassmorphism Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-raised/90 p-2 shadow-elevation-2 backdrop-blur-md">
        {TOOLS.map((tool) => (
          <button
            key={tool.type}
            onClick={() => setActiveTool(tool.type)}
            className={`flex size-9 items-center justify-center rounded-sm transition-all duration-180 ease-apple-spring cursor-pointer ${
              activeTool === tool.type
                ? 'bg-accent text-accent-foreground font-semibold shadow-elevation-1 scale-[1.02]'
                : 'text-muted-foreground hover:bg-surface-sunken hover:text-foreground active:scale-95'
            }`}
            aria-label={t(`tools.${tool.a11yKey}`)}
            aria-pressed={activeTool === tool.type}
            title={t(`tools.${tool.a11yKey}`)}
          >
            <tool.icon className="size-4" aria-hidden />
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <input
            type="color"
            value={activeColor}
            onChange={(e) => setActiveColor(e.target.value)}
            className="size-7 cursor-pointer rounded-xs border border-border bg-transparent p-0.5"
            title={t('color')}
          />
          {pins.length > 0 && (
            <span className="rounded-xs bg-accent-muted/40 px-2 py-1 font-mono text-xs font-semibold text-accent">
              {pins.length} {t('pins')}
            </span>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-border"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Background image */}
        <Image
          src={imageUrl}
          alt={t('photo')}
          width={1200}
          height={900}
          className="block w-full h-auto"
          draggable={false}
          priority
          onLoad={() => {
            setImageLoaded(true)
          }}
        />

        {/* SVG overlay */}
        {imageLoaded && (
          <svg
            className="pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Saved pins */}
            {pins.map((pin) => (
              <g
                key={pin.id}
                className="pointer-events-auto"
                onMouseEnter={() => setHoveredPin(pin.id)}
                onMouseLeave={() => setHoveredPin(null)}
              >
                {pin.pin_type === 'pin' && (
                  <circle cx={pin.x} cy={pin.y} r={4} fill={pin.color} stroke="white" strokeWidth={1.5} />
                )}
                {pin.pin_type === 'arrow' && (
                  <line
                    x1={pin.x} y1={pin.y}
                    x2={pin.x + (pin.width ?? 0)} y2={pin.y + (pin.height ?? 0)}
                    stroke={pin.color}
                    strokeWidth={1.5}
                    markerEnd="url(#arrowhead)"
                  />
                )}
                {pin.pin_type === 'rectangle' && (
                  <rect
                    x={pin.x} y={pin.y}
                    width={pin.width ?? 10} height={pin.height ?? 10}
                    fill="none"
                    stroke={pin.color}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                )}
                {pin.pin_type === 'circle' && (
                  <ellipse
                    cx={pin.x + (pin.width ?? 5) / 2}
                    cy={pin.y + (pin.height ?? 5) / 2}
                    rx={Math.abs(pin.width ?? 5) / 2}
                    ry={Math.abs(pin.height ?? 5) / 2}
                    fill="none"
                    stroke={pin.color}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                )}
                {pin.pin_type === 'freehand' && !!pin.drawing_data?.path && (
                  <path
                    d={`M ${pin.x} ${pin.y} ${pin.drawing_data.path as string}`}
                    fill="none"
                    stroke={pin.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                )}
                {pin.pin_type === 'text' && (
                  <text
                    x={pin.x}
                    y={pin.y}
                    fill={pin.color}
                    fontSize={4}
                    fontWeight="bold"
                  >
                    {pin.label}
                  </text>
                )}

                {/* Hover delete button */}
                {hoveredPin === pin.id && canWrite && (
                  <g
                    className="cursor-pointer"
                    onClick={() => removePin(pin.id)}
                  >
                    <circle cx={pin.x + 6} cy={pin.y - 6} r={3} fill={DEFAULT_DRAW_COLOR} />
                    <text
                      x={pin.x + 6}
                      y={pin.y - 4.5}
                      textAnchor="middle"
                      fill="white"
                      fontSize={3}
                      fontWeight="bold"
                    >
                      ×
                    </text>
                  </g>
                )}
              </g>
            ))}

            {/* Draft shape being drawn */}
            {drawing && activeTool === 'arrow' && (
              <line
                x1={startPos.x} y1={startPos.y}
                x2={currentPos.x} y2={currentPos.y}
                stroke={activeColor}
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}
            {drawing && (activeTool === 'rectangle') && (
              <rect
                x={Math.min(startPos.x, currentPos.x)}
                y={Math.min(startPos.y, currentPos.y)}
                width={Math.abs(currentPos.x - startPos.x)}
                height={Math.abs(currentPos.y - startPos.y)}
                fill="none"
                stroke={activeColor}
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}
            {drawing && (activeTool === 'circle') && (
              <ellipse
                cx={(startPos.x + currentPos.x) / 2}
                cy={(startPos.y + currentPos.y) / 2}
                rx={Math.abs(currentPos.x - startPos.x) / 2}
                ry={Math.abs(currentPos.y - startPos.y) / 2}
                fill="none"
                stroke={activeColor}
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}

            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill={activeColor} />
              </marker>
            </defs>
          </svg>
        )}

        {/* Text input overlay */}
        {textInput.show && (
          <div
            className="pointer-events-auto absolute"
            style={{
              left: `${textInput.x}%`,
              top: `${textInput.y}%`,
            }}
          >
            <input
              autoFocus
              value={textInput.value}
              onChange={(e) => setTextInput((prev) => ({ ...prev, value: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTextSubmit()
                if (e.key === 'Escape') setTextInput({ show: false, x: 0, y: 0, value: '' })
              }}
              onBlur={handleTextSubmit}
              className="rounded border border-primary bg-background px-2 py-1 text-sm shadow-lg"
              style={{ borderColor: activeColor }}
              placeholder={t('typeHere')}
            />
          </div>
        )}
      </div>

      {!canWrite && (
        <p className="text-center text-xs text-muted-foreground">{t('readonly')}</p>
      )}
    </div>
  )
}
