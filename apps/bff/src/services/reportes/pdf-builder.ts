/**
 * Motor ligero y autónomo de generación de documentos PDF (ISO 32000-1 / PDF 1.4).
 * Diseñado en TypeScript puro con cero dependencias externas nativas.
 * Soporta hojas A4, tipografía profesional estándar (Helvetica / Times),
 * paleta de colores RGB, cajas de texto con salto de línea automático, tablas
 * estructuradas, badges agronómicos, encabezados institucionales y paginación.
 */

export type FontName =
  | 'Helvetica'
  | 'Helvetica-Bold'
  | 'Helvetica-Oblique'
  | 'Times-Roman'
  | 'Times-Bold';

export interface DrawTextOptions {
  font?: FontName;
  size?: number;
  color?: string; // Hex e.g. '#0f172a' o '#047857'
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

export interface DrawRectOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface TableOptions {
  x: number;
  y: number;
  colWidths: number[];
  headers: string[];
  rows: (string | null | undefined)[][];
  headerBg?: string;
  headerTextColor?: string;
  altRowBg?: string;
  borderColor?: string;
  fontSize?: number;
  rowHeight?: number;
  alignments?: ('left' | 'center' | 'right')[];
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/**
 * Convierte un color hexadecimal '#RRGGBB' a valores normalizados 0..1 para PDF.
 */
function hexToPdfRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [
    isNaN(r) ? 0 : Number(r.toFixed(3)),
    isNaN(g) ? 0 : Number(g.toFixed(3)),
    isNaN(b) ? 0 : Number(b.toFixed(3)),
  ];
}

/**
 * Sanitiza y codifica cadenas de texto para el estándar PDF WinAnsiEncoding,
 * traduciendo caracteres acentuados españoles, diéresis, ñ y símbolos habituales.
 */
export function sanitizePdfText(input: string): string {
  if (!input) return '';

  return input
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // Reemplazos de caracteres especiales a WinAnsi (octal de 3 dígitos)
    .replace(/á/g, '\\341')
    .replace(/é/g, '\\351')
    .replace(/í/g, '\\355')
    .replace(/ó/g, '\\363')
    .replace(/ú/g, '\\372')
    .replace(/Á/g, '\\301')
    .replace(/É/g, '\\311')
    .replace(/Í/g, '\\315')
    .replace(/Ó/g, '\\323')
    .replace(/Ú/g, '\\332')
    .replace(/ñ/g, '\\361')
    .replace(/Ñ/g, '\\321')
    .replace(/ü/g, '\\374')
    .replace(/Ü/g, '\\334')
    .replace(/°/g, '\\260')
    .replace(/¿/g, '\\277')
    .replace(/¡/g, '\\241')
    .replace(/·/g, '\\267')
    .replace(/–/g, '\\226')
    .replace(/—/g, '\\227')
    .replace(/“/g, '\\223')
    .replace(/”/g, '\\224')
    .replace(/‘/g, '\\221')
    .replace(/’/g, '\\222')
    // Símbolos matemáticos y flechas simplificados a ASCII legible
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/±/g, '+/-')
    .replace(/➔|➜|→/g, '->')
    .replace(/←/g, '<-')
    .replace(/•/g, '*')
    // Eliminar emojis no soportados por fuentes Type1 para evitar corrupción visual
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '');
}

/**
 * Estimación del ancho en puntos de una cadena según la fuente y tamaño.
 */
function estimateTextWidth(text: string, font: FontName, fontSize: number): number {
  const isBold = font.includes('Bold');
  const avgCharWidthRatio = isBold ? 0.55 : 0.48;
  // Descontar secuencias de escape octales como \341 para medir el caracter real
  const plainText = text.replace(/\\[0-9]{3}/g, 'x');
  return plainText.length * fontSize * avgCharWidthRatio;
}

interface PageStream {
  operations: string[];
}

export class PdfDocumentBuilder {
  private pages: PageStream[] = [];
  private currentPageIndex = -1;
  private readonly pageWidth = A4_WIDTH;
  private readonly pageHeight = A4_HEIGHT;
  private readonly margin: number;

  constructor(options?: { margin?: number }) {
    this.margin = options?.margin ?? 36; // 0.5 pulgada por defecto
    this.addPage();
  }

  public getWidth(): number {
    return this.pageWidth;
  }

  public getHeight(): number {
    return this.pageHeight;
  }

  public getMargin(): number {
    return this.margin;
  }

  public getUsableWidth(): number {
    return this.pageWidth - this.margin * 2;
  }

  public getCurrentPage(): number {
    return this.currentPageIndex + 1;
  }

  public getTotalPages(): number {
    return this.pages.length;
  }

  public addPage(): void {
    this.pages.push({ operations: [] });
    this.currentPageIndex = this.pages.length - 1;
  }

  private op(cmd: string): void {
    if (this.currentPageIndex >= 0) {
      this.pages[this.currentPageIndex].operations.push(cmd);
    }
  }

  /**
   * Convierte una coordenada Y descendente (origen arriba) a coordenadas PDF estándar (origen abajo).
   */
  private toPdfY(y: number): number {
    return this.pageHeight - y;
  }

  private mapFontId(font: FontName): string {
    switch (font) {
      case 'Helvetica-Bold':
        return '/F2';
      case 'Helvetica-Oblique':
        return '/F3';
      case 'Times-Roman':
        return '/F4';
      case 'Times-Bold':
        return '/F5';
      case 'Helvetica':
      default:
        return '/F1';
    }
  }

  /**
   * Dibuja un rectángulo con relleno y/o contorno.
   */
  public drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: DrawRectOptions,
  ): void {
    const pdfY = this.toPdfY(y + height);
    this.op('q');

    if (options?.fill) {
      const [r, g, b] = hexToPdfRgb(options.fill);
      this.op(`${r} ${g} ${b} rg`);
    }

    if (options?.stroke) {
      const [r, g, b] = hexToPdfRgb(options.stroke);
      this.op(`${r} ${g} ${b} RG`);
      const lw = options.strokeWidth ?? 1;
      this.op(`${lw} w`);
    }

    this.op(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);

    if (options?.fill && options?.stroke) {
      this.op('B'); // Fill and stroke
    } else if (options?.fill) {
      this.op('f'); // Fill only
    } else if (options?.stroke) {
      this.op('S'); // Stroke only
    } else {
      this.op('n'); // No-op path
    }

    this.op('Q');
  }

  /**
   * Dibuja una línea entre dos puntos.
   */
  public drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options?: { color?: string; width?: number },
  ): void {
    this.op('q');
    const [r, g, b] = hexToPdfRgb(options?.color ?? '#cbd5e1');
    this.op(`${r} ${g} ${b} RG`);
    this.op(`${(options?.width ?? 1).toFixed(2)} w`);
    this.op(`${x1.toFixed(2)} ${this.toPdfY(y1).toFixed(2)} m`);
    this.op(`${x2.toFixed(2)} ${this.toPdfY(y2).toFixed(2)} l`);
    this.op('S');
    this.op('Q');
  }

  /**
   * Dibuja un texto simple en una línea.
   */
  public drawText(
    text: string,
    x: number,
    y: number,
    options?: DrawTextOptions,
  ): number {
    const font = options?.font ?? 'Helvetica';
    const size = options?.size ?? 10;
    const color = options?.color ?? '#0f172a';
    const align = options?.align ?? 'left';
    const fontId = this.mapFontId(font);
    const sanitized = sanitizePdfText(text);

    let drawX = x;
    const estWidth = estimateTextWidth(sanitized, font, size);

    if (align === 'center') {
      drawX = x - estWidth / 2;
    } else if (align === 'right') {
      drawX = x - estWidth;
    }

    const pdfY = this.toPdfY(y);

    this.op('q');
    this.op('BT');
    const [r, g, b] = hexToPdfRgb(color);
    this.op(`${r} ${g} ${b} rg`);
    this.op(`${fontId} ${size} Tf`);
    this.op(`${drawX.toFixed(2)} ${pdfY.toFixed(2)} Td`);
    this.op(`(${sanitized}) Tj`);
    this.op('ET');
    this.op('Q');

    return estWidth;
  }

  /**
   * Dibuja un párrafo con wrap de palabras automático respetando un ancho máximo.
   * Devuelve la coordenada Y donde termina el párrafo.
   */
  public drawParagraph(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options?: {
      font?: FontName;
      size?: number;
      color?: string;
      lineHeight?: number;
    },
  ): number {
    const font = options?.font ?? 'Helvetica';
    const size = options?.size ?? 9.5;
    const lineHeight = options?.lineHeight ?? size * 1.35;
    const color = options?.color ?? '#334155';

    const words = text.split(/\s+/);
    let currentLine = '';
    let currentY = y;

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = estimateTextWidth(sanitizePdfText(candidate), font, size);

      if (width > maxWidth && currentLine) {
        this.drawText(currentLine, x, currentY, { font, size, color });
        currentY += lineHeight;
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }

    if (currentLine) {
      this.drawText(currentLine, x, currentY, { font, size, color });
      currentY += lineHeight;
    }

    return currentY;
  }

  /**
   * Dibuja un badge / etiqueta redondeada (estilo píldora).
   */
  public drawBadge(
    text: string,
    x: number,
    y: number,
    options?: {
      bg?: string;
      textColor?: string;
      border?: string;
      fontSize?: number;
    },
  ): number {
    const fontSize = options?.fontSize ?? 8;
    const font: FontName = 'Helvetica-Bold';
    const textWidth = estimateTextWidth(sanitizePdfText(text), font, fontSize);
    const paddingX = 7;
    const badgeWidth = textWidth + paddingX * 2;
    const badgeHeight = fontSize * 1.8;

    this.drawRect(x, y - badgeHeight * 0.75, badgeWidth, badgeHeight, {
      fill: options?.bg ?? '#ecfdf5',
      stroke: options?.border ?? '#a7f3d0',
      strokeWidth: 0.75,
    });

    this.drawText(text, x + paddingX, y, {
      font,
      size: fontSize,
      color: options?.textColor ?? '#065f46',
    });

    return badgeWidth;
  }

  /**
   * Dibuja una tarjeta / card contenedora con fondo suave y borde.
   */
  public drawCard(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: { bg?: string; border?: string; strokeWidth?: number },
  ): void {
    this.drawRect(x, y, width, height, {
      fill: options?.bg ?? '#f8fafc',
      stroke: options?.border ?? '#e2e8f0',
      strokeWidth: options?.strokeWidth ?? 1,
    });
  }

  /**
   * Divide un texto en múltiples líneas respetando palabras para no sobrepasar maxWidth puntos.
   */
  public wrapText(
    text: string,
    maxWidth: number,
    font: FontName = 'Helvetica',
    fontSize: number = 8.5,
  ): string[] {
    if (!text || text.trim() === '') {
      return ['-'];
    }

    // Si el texto ya tiene saltos de línea explícitos, los respetamos
    const paragraphs = text.split('\n');
    const allLines: string[] = [];

    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      let currentLine = '';

      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        const width = estimateTextWidth(sanitizePdfText(candidate), font, fontSize);

        if (width > maxWidth && currentLine) {
          allLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = candidate;
        }
      }

      if (currentLine) {
        allLines.push(currentLine);
      }
    }

    return allLines.length > 0 ? allLines : ['-'];
  }

  /**
   * Dibuja una tabla con cabecera estilizada, filas alternadas y soporte de multilínea automático por celda.
   *
   * Nota de diseño / paginación: La tabla se dibuja secuencialmente hacia abajo calculando la altura dinámica
   * de cada fila en la página actual. En la implementación actual para reportes fijos (US-11), el lote
   * de 4 años encaja dentro de los márgenes de la página A4. Si en el futuro se requiriese un horizonte
   * arbitrario de filas, debe gestionarse la fragmentación con `addPage()` para evitar desbordes visuales.
   */
  public drawTable(options: TableOptions): number {
    const {
      x,
      y,
      colWidths,
      headers,
      rows,
      headerBg = '#064e3b', // Esmeralda profundo institucional
      headerTextColor = '#ffffff',
      altRowBg = '#f8fafc',
      borderColor = '#e2e8f0',
      fontSize = 8.5,
      rowHeight = 20,
      alignments = [],
    } = options;

    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    const lineSpacing = fontSize * 1.25;
    let currentY = y;

    // 1. Dibujar Cabecera
    this.drawRect(x, currentY, totalWidth, rowHeight, {
      fill: headerBg,
      stroke: borderColor,
      strokeWidth: 1,
    });

    let currentX = x;
    headers.forEach((header, i) => {
      const colW = colWidths[i];
      const align = alignments[i] ?? 'left';
      let textX = currentX + 6;
      if (align === 'center') textX = currentX + colW / 2;
      if (align === 'right') textX = currentX + colW - 6;

      this.drawText(header, textX, currentY + 13, {
        font: 'Helvetica-Bold',
        size: fontSize,
        color: headerTextColor,
        align,
      });
      currentX += colW;
    });

    currentY += rowHeight;

    // 2. Dibujar Filas de Datos con ajuste automático de altura y saltos de línea por celda
    rows.forEach((row, rowIndex) => {
      const isAlt = rowIndex % 2 === 1;

      // Calcular las líneas de texto para cada columna respetando el ancho de celda menos márgenes
      const cellLinesByCol: string[][] = row.map((cellValue, colIndex) => {
        const colW = colWidths[colIndex];
        const maxTextW = Math.max(colW - 12, 10);
        const font: FontName = colIndex === 0 ? 'Helvetica-Bold' : 'Helvetica';
        const val = cellValue !== null && cellValue !== undefined ? String(cellValue) : '-';
        return this.wrapText(val, maxTextW, font, fontSize);
      });

      // La altura de la fila se expande según la celda que tenga más líneas
      const maxLinesInRow = Math.max(1, ...cellLinesByCol.map((lines) => lines.length));
      const dynamicRowHeight = Math.max(
        rowHeight,
        8 + maxLinesInRow * lineSpacing + 4,
      );

      // Dibujar fondo y contorno de la fila
      this.drawRect(x, currentY, totalWidth, dynamicRowHeight, {
        fill: isAlt ? altRowBg : '#ffffff',
        stroke: borderColor,
        strokeWidth: 0.5,
      });

      // Dibujar el texto de cada celda con centrado vertical
      let cellX = x;
      row.forEach((_, colIndex) => {
        const colW = colWidths[colIndex];
        const align = alignments[colIndex] ?? 'left';
        const lines = cellLinesByCol[colIndex];
        const font: FontName = colIndex === 0 ? 'Helvetica-Bold' : 'Helvetica';

        let textX = cellX + 6;
        if (align === 'center') textX = cellX + colW / 2;
        if (align === 'right') textX = cellX + colW - 6;

        const totalTextHeight = lines.length * lineSpacing;
        const startY =
          currentY + (dynamicRowHeight - totalTextHeight) / 2 + fontSize * 0.85;

        lines.forEach((lineText, lineIdx) => {
          this.drawText(lineText, textX, startY + lineIdx * lineSpacing, {
            font,
            size: fontSize,
            color: '#1e293b',
            align,
          });
        });

        cellX += colW;
      });

      currentY += dynamicRowHeight;
    });

    return currentY;
  }

  /**
   * Compila la estructura en memoria y devuelve el Buffer binario del archivo PDF válido.
   */
  public build(): Buffer {
    const totalPages = this.pages.length;
    const bodyObjects: string[] = [];
    const offsets: number[] = [];

    // Header PDF estándar
    const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';

    // Objeto 1: Catalog
    // Objeto 2: Pages container
    // Objetos 3-7: Fuentes estándar Type1 con codificación WinAnsi
    const catalogObjIndex = 1;
    const pagesObjIndex = 2;

    // Añadir placeholders temporales para Catalog y Pages
    bodyObjects.push(''); // 1 Catalog
    offsets.push(0);
    bodyObjects.push(''); // 2 Pages
    offsets.push(0);

    // Fuentes estándar
    const fonts: { id: string; baseFont: FontName }[] = [
      { id: '/F1', baseFont: 'Helvetica' },
      { id: '/F2', baseFont: 'Helvetica-Bold' },
      { id: '/F3', baseFont: 'Helvetica-Oblique' },
      { id: '/F4', baseFont: 'Times-Roman' },
      { id: '/F5', baseFont: 'Times-Bold' },
    ];

    const fontObjIds: number[] = [];
    fonts.forEach((f) => {
      const idx = bodyObjects.length + 1;
      fontObjIds.push(idx);
      offsets.push(0);
      bodyObjects.push(
        `${idx} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${f.baseFont} /Encoding /WinAnsiEncoding >>\nendobj\n`,
      );
    });

    // Recursos compartidos de fuente
    const fontResources = fonts
      .map((f, i) => `${f.id} ${fontObjIds[i]} 0 R`)
      .join(' ');

    const pageObjIds: number[] = [];

    // Construir páginas y contenidos
    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const pageStream = this.pages[i];

      // Pie de página institucional automático en cada página
      const [fr, fg, fb] = hexToPdfRgb('#64748b');
      pageStream.operations.push('q');
      pageStream.operations.push('BT');
      pageStream.operations.push(`${fr} ${fg} ${fb} rg`);
      pageStream.operations.push(`/F1 8 Tf`);
      pageStream.operations.push(
        `${this.margin} 20 Td (ProyectoDACS \\267 Informe T\\351cnico Agr\\363nomo \\267 Documento confidencial de apoyo a la decisi\\363n) Tj`,
      );
      pageStream.operations.push('ET');

      // Número de página a la derecha
      const pagText = `P\\341gina ${pageNum} de ${totalPages}`;
      const pagX = this.pageWidth - this.margin - 65;
      pageStream.operations.push('BT');
      pageStream.operations.push(`${fr} ${fg} ${fb} rg`);
      pageStream.operations.push(`/F1 8 Tf`);
      pageStream.operations.push(`${pagX} 20 Td (${pagText}) Tj`);
      pageStream.operations.push('ET');
      pageStream.operations.push('Q');

      // Línea divisoria de pie de página
      pageStream.operations.push('q');
      pageStream.operations.push('0.85 0.88 0.92 RG');
      pageStream.operations.push('0.5 w');
      pageStream.operations.push(`${this.margin} 30 m ${this.pageWidth - this.margin} 30 l S`);
      pageStream.operations.push('Q');

      // Flujo de operaciones de contenido
      const streamContent = pageStream.operations.join('\n');
      const streamLen = Buffer.byteLength(streamContent, 'latin1');

      const contentObjIdx = bodyObjects.length + 1;
      offsets.push(0);
      bodyObjects.push(
        `${contentObjIdx} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
      );

      const pageObjIdx = bodyObjects.length + 1;
      offsets.push(0);
      pageObjIds.push(pageObjIdx);
      bodyObjects.push(
        `${pageObjIdx} 0 obj\n<< /Type /Page /Parent ${pagesObjIndex} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << ${fontResources} >> >> /Contents ${contentObjIdx} 0 R >>\nendobj\n`,
      );
    }

    // Configurar Catalog (Objeto 1) y Pages (Objeto 2)
    const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
    bodyObjects[0] = `1 0 obj\n<< /Type /Catalog /Pages ${pagesObjIndex} 0 R >>\nendobj\n`;
    bodyObjects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>\nendobj\n`;

    // Recalcular offsets exactos de cada objeto en bytes
    let runningOffset = Buffer.byteLength(header, 'latin1');
    for (let i = 0; i < bodyObjects.length; i++) {
      offsets[i] = runningOffset;
      runningOffset += Buffer.byteLength(bodyObjects[i], 'latin1');
    }

    // Generar tabla XREF y Trailer
    const xrefOffset = runningOffset;
    let xref = `xref\n0 ${bodyObjects.length + 1}\n0000000000 65535 f \r\n`;
    for (const off of offsets) {
      const padded = off.toString().padStart(10, '0');
      xref += `${padded} 00000 n \r\n`;
    }

    const trailer = `trailer\n<< /Size ${bodyObjects.length + 1} /Root ${catalogObjIndex} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    const fullPdfString = header + bodyObjects.join('') + xref + trailer;
    return Buffer.from(fullPdfString, 'latin1');
  }
}
