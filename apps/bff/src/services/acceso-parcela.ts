import { prisma } from '../db.js';

export interface EvaluacionAcceso {
  permitida: boolean;
  motivo: 'PROPIETARIO' | 'TECNICO_ASOCIADO' | 'FORBIDDEN';
  error?: string;
}

/**
 * Lógica pura de autorización de acceso a parcelas e informes (US-11 CA 3):
 * - Permitido si el solicitante es el dueño de la parcela (PROPIETARIO).
 * - Permitido si el solicitante es técnico extensionista ('TECNICO') Y el productor dueño le otorgó acceso (TECNICO_ASOCIADO).
 * - En cualquier otro caso, acceso denegado (FORBIDDEN).
 */
export function evaluarAccesoParcela(
  usuario: { id: string; rol: string },
  parcelaUserId: string,
  esAsociadoActivo: boolean,
): EvaluacionAcceso {
  if (parcelaUserId === usuario.id) {
    return { permitida: true, motivo: 'PROPIETARIO' };
  }

  if (usuario.rol === 'TECNICO' && esAsociadoActivo) {
    return { permitida: true, motivo: 'TECNICO_ASOCIADO' };
  }

  return {
    permitida: false,
    motivo: 'FORBIDDEN',
    error: 'Parcela no encontrada',
  };
}

/**
 * Busca una parcela verificando los permisos de acceso del usuario:
 * - El dueño de la parcela tiene acceso irrestricto.
 * - Un técnico extensionista ('TECNICO') solo accede si el productor dueño le otorgó acceso previamente en AsociacionProductor.
 * - Si no existe o no tiene permisos, devuelve null (anti-enumeración: siempre 404).
 */
export async function buscarParcelaConAcceso(
  parcelaId: string,
  userId: string,
  userRol: string,
) {
  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
  });

  if (!parcela) {
    return null;
  }

  // 1. Dueño legítimo
  if (parcela.userId === userId) {
    return parcela;
  }

  // 2. Solo usuarios con rol TECNICO pueden acceder a parcelas de terceros
  if (userRol !== 'TECNICO') {
    return null;
  }

  // 3. Verificar que el productor dueño le haya otorgado acceso a este técnico
  const asociacion = await prisma.asociacionProductor.findFirst({
    where: {
      tecnicoId: userId,
      productorId: parcela.userId,
    },
  });

  return asociacion ? parcela : null;
}
