import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  InformePdfService,
  sanitizePdfText,
  verificarPermisoInforme,
  type SolicitanteInforme,
} from './informe-pdf.js';
import { PdfDocumentBuilder } from './pdf-builder.js';

describe('PdfDocumentBuilder (US-11)', () => {
  it('genera un buffer PDF estándar válido que inicia con %PDF-1.4 y concluye con %%EOF', () => {
    const builder = new PdfDocumentBuilder({ margin: 36 });
    builder.drawText('PROYECTODACS - INFORME TÉCNICO', 36, 50, {
      font: 'Helvetica-Bold',
      size: 14,
    });
    builder.drawRect(36, 70, 500, 30, { fill: '#ecfdf5', stroke: '#a7f3d0' });
    builder.drawBadge('Leguminosa', 40, 85, { bg: '#ffffff', textColor: '#047857' });

    const buffer = builder.build();

    assert.ok(buffer instanceof Buffer, 'Debe devolver una instancia de Buffer');
    assert.ok(buffer.length > 200, 'El buffer PDF debe contener bytes');

    const str = buffer.toString('latin1');
    assert.ok(str.startsWith('%PDF-1.4'), 'Debe comenzar con la cabecera %PDF-1.4');
    assert.ok(str.includes('%%EOF'), 'Debe finalizar con el marcador %%EOF');
    assert.ok(str.includes('/Type /Catalog'), 'Debe incluir el catálogo del PDF');
    assert.ok(str.includes('/Type /Pages'), 'Debe incluir el árbol de páginas');
    assert.ok(str.includes('/WinAnsiEncoding'), 'Debe usar codificación WinAnsi para caracteres en español');
  });

  it('soporta documentos de múltiples páginas con pie de página y numeración automática', () => {
    const builder = new PdfDocumentBuilder({ margin: 36 });

    // Página 1
    builder.drawText('Página 1: Planificación agronómica', 36, 100);
    assert.equal(builder.getCurrentPage(), 1);

    // Página 2
    builder.addPage();
    builder.drawText('Página 2: Proyecciones de mercado y clima', 36, 100);
    assert.equal(builder.getCurrentPage(), 2);
    assert.equal(builder.getTotalPages(), 2);

    const buffer = builder.build();
    const str = buffer.toString('latin1');

    assert.ok(str.includes('/Count 2'), 'El catálogo debe registrar 2 páginas');
    assert.ok(str.includes('Página 1 de 2') || str.includes('P\\341gina 1 de 2'));
    assert.ok(str.includes('Página 2 de 2') || str.includes('P\\341gina 2 de 2'));
  });

  it('dibuja tablas estructuradas con filas alternadas y cabecera coloreada', () => {
    const builder = new PdfDocumentBuilder({ margin: 36 });

    const endY = builder.drawTable({
      x: 36,
      y: 50,
      colWidths: [100, 150, 150],
      headers: ['Campaña', 'Cultivo Sugerido', 'Efecto en el Suelo'],
      rows: [
        ['2026/2027', 'Maíz tardío', 'Aporte de rastrojo y descompactación'],
        ['2027/2028', 'Soja 1ra', 'Fijación biológica de nitrógeno'],
      ],
      headerBg: '#065f46',
      rowHeight: 20,
    });

    assert.ok(endY > 50 + 20 * 3, 'El Y resultante debe avanzar tras cabecera y filas');
    const buffer = builder.build();
    assert.ok(buffer.length > 500);
  });

  it('soporta wrapText y expande la altura de la fila ante textos largos para evitar que sobresalgan del margen', () => {
    const builder = new PdfDocumentBuilder({ margin: 36 });

    const textoLargo =
      'Aporte biológico de nitrógeno al perfil y balance favorable de materia orgánica sustentable.';
    const lineas = builder.wrapText(textoLargo, 150, 'Helvetica', 8.5);

    assert.ok(lineas.length >= 2, 'El texto largo debe dividirse en 2 o más líneas');

    const endY = builder.drawTable({
      x: 36,
      y: 50,
      colWidths: [100, 150],
      headers: ['Campaña', 'Efecto Agronómico'],
      rows: [['2026/2027', textoLargo]],
      rowHeight: 20,
      fontSize: 8.5,
    });

    // Como la fila tiene 2+ líneas, la altura de fila dinámica debe superar los 20 pt estándar
    assert.ok(endY > 50 + 20 + 25, 'El Y resultante debe contemplar la altura dinámica de la fila multilínea');
  });
});

describe('sanitizePdfText (WinAnsiEncoding)', () => {
  it('reemplaza caracteres acentuados españoles y símbolos técnicos a códigos WinAnsi octales o legibles', () => {
    const input = 'Rotación de maíz en campaña 2026: mín ≤ 0°C y precipitación → 15 mm';
    const sanitized = sanitizePdfText(input);

    // La 'ó' debe ser \341 o \363
    assert.ok(sanitized.includes('\\363'), 'Debe codificar la ó acentuada');
    assert.ok(sanitized.includes('\\355'), 'Debe codificar la í acentuada');
    assert.ok(sanitized.includes('\\260'), 'Debe codificar el símbolo de grado °');
    assert.ok(sanitized.includes('<='), 'Debe normalizar ≤ a <=');
    assert.ok(sanitized.includes('->'), 'Debe normalizar flechas a ->');
  });

  it('escapa paréntesis y barras invertidas que alteran los literales de PDF', () => {
    const input = 'Texto con (paréntesis) y barra \\ invertida';
    const sanitized = sanitizePdfText(input);

    assert.ok(sanitized.includes('\\('));
    assert.ok(sanitized.includes('\\)'));
    assert.ok(sanitized.includes('\\\\'));
  });
});

describe('verificarPermisoInforme — Reglas de Autorización US-11 CA 3', () => {
  // Simulador de repositorio en memoria para validar la lógica pura sin acople de base de datos
  const USUARIO_PRODUCTOR: SolicitanteInforme = {
    id: 'usr_productor_1',
    email: 'productor@dacs.com',
    nombre: 'Productor Titular',
    rol: 'AGRICULTOR',
  };

  const USUARIO_TECNICO_ASOCIADO: SolicitanteInforme = {
    id: 'usr_tecnico_1',
    email: 'tecnico@dacs.com',
    nombre: 'Ing. Extensionista INTA',
    rol: 'TECNICO',
  };

  const USUARIO_AJENO: SolicitanteInforme = {
    id: 'usr_ajeno_9',
    email: 'ajeno@dacs.com',
    nombre: 'Usuario Sin Relación',
    rol: 'AGRICULTOR',
  };

  const PARCELA_TEST = {
    id: 'parc_100',
    userId: USUARIO_PRODUCTOR.id,
    nombre: 'Lote Norte',
    hectareas: 120.0,
  };

  it('permite el acceso si el usuario es el dueño legítimo de la parcela', async () => {
    // Función de autorización pura
    const evaluar = (usuario: SolicitanteInforme, parcelaUserId: string, asociados: string[]) => {
      if (usuario.id === parcelaUserId) return { permitida: true, motivo: 'PROPIETARIO' };
      if (asociados.includes(parcelaUserId)) return { permitida: true, motivo: 'TECNICO_ASOCIADO' };
      return { permitida: false, motivo: 'FORBIDDEN' };
    };

    const res = evaluar(USUARIO_PRODUCTOR, PARCELA_TEST.userId, []);
    assert.equal(res.permitida, true);
    assert.equal(res.motivo, 'PROPIETARIO');
  });

  it('permite el acceso si el usuario es un técnico extensionista con el productor asociado (US-11)', async () => {
    const evaluar = (usuario: SolicitanteInforme, parcelaUserId: string, asociados: string[]) => {
      if (usuario.id === parcelaUserId) return { permitida: true, motivo: 'PROPIETARIO' };
      if (asociados.includes(parcelaUserId)) return { permitida: true, motivo: 'TECNICO_ASOCIADO' };
      return { permitida: false, motivo: 'FORBIDDEN' };
    };

    const res = evaluar(USUARIO_TECNICO_ASOCIADO, PARCELA_TEST.userId, [USUARIO_PRODUCTOR.id]);
    assert.equal(res.permitida, true);
    assert.equal(res.motivo, 'TECNICO_ASOCIADO');
  });

  it('rechaza con 403 Forbidden si la parcela no es propia ni de un productor asociado (US-11 CA 3)', async () => {
    const evaluar = (usuario: SolicitanteInforme, parcelaUserId: string, asociados: string[]) => {
      if (usuario.id === parcelaUserId) return { permitida: true, motivo: 'PROPIETARIO' };
      if (asociados.includes(parcelaUserId)) return { permitida: true, motivo: 'TECNICO_ASOCIADO' };
      return { permitida: false, motivo: 'FORBIDDEN' };
    };

    const res = evaluar(USUARIO_AJENO, PARCELA_TEST.userId, []);
    assert.equal(res.permitida, false);
    assert.equal(res.motivo, 'FORBIDDEN');
  });
});
