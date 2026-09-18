declare module 'pdfkit' {
  namespace PDFKit {
    interface PDFDocument {
      registerFont(name: string, src: string): this
      font(name: string): this
      font(name: string, size?: number): this
      fontSize(size: number): this
      text(text: string, x?: number, y?: number, options?: {
        align?: 'left' | 'center' | 'right' | 'justify'
        width?: number
        height?: number
      }): this
      image(src: string, x?: number, y?: number, options?: {
        width?: number
        height?: number
        fit?: [number, number]
        align?: 'center' | 'left' | 'right'
        valign?: 'center' | 'top' | 'bottom'
      }): this
      moveDown(lines?: number): this
      addPage(): this
      end(): void
      pipe(dest: NodeJS.WritableStream): NodeJS.WritableStream
      y: number
      page: { width: number; height: number }
      bufferedPageRange(): { start: number; count: number }
      switchToPage(index: number): this
      moveTo(x: number, y: number): this
      lineTo(x: number, y: number): this
      lineWidth(width: number): this
      strokeColor(color: string): this
      stroke(): this
      fillColor(color: string): this
    }
  }

  interface PDFDocumentOptions {
    size?: string | [number, number]
    margins?: {
      top?: number
      bottom?: number
      left?: number
      right?: number
    }
    bufferPages?: boolean
    info?: {
      Title?: string
      Creator?: string
    }
  }

  class PDFDocument implements PDFKit.PDFDocument {
    constructor(options?: PDFDocumentOptions)
    registerFont(name: string, src: string): this
    font(name: string): this
    font(name: string, size?: number): this
    fontSize(size: number): this
    text(text: string, x?: number, y?: number, options?: {
      align?: 'left' | 'center' | 'right' | 'justify'
      width?: number
      height?: number
    }): this
    image(src: string, x?: number, y?: number, options?: {
      width?: number
      height?: number
      fit?: [number, number]
      align?: 'center' | 'left' | 'right'
      valign?: 'center' | 'top' | 'bottom'
    }): this
    moveDown(lines?: number): this
    addPage(): this
    end(): void
    pipe(dest: NodeJS.WritableStream): NodeJS.WritableStream
    y: number
    page: { width: number; height: number }
    bufferedPageRange(): { start: number; count: number }
    switchToPage(index: number): this
    moveTo(x: number, y: number): this
    lineTo(x: number, y: number): this
    lineWidth(width: number): this
    strokeColor(color: string): this
    stroke(): this
    fillColor(color: string): this
  }

  export = PDFDocument
}
