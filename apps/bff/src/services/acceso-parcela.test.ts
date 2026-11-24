import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluarAccesoParcela } from './acceso-parcela.js';

describe('evaluarAccesoParcela — Control de Acceso y Autorización (US-11 CA 3)', () => {
  const USUARIO_PRODUCTOR = {
    id: 'usr_productor_1',
    rol: 'AGRICULTOR',
  };

  const USUARIO_TECNICO = {
    id: 'usr_tecnico_1',
    rol: 'TECNICO',
  };

  const USUARIO_AJENO = {
    id: 'usr_ajeno_9',
    rol: 'AGRICULTOR',
  };

  const PARCELA_TEST = {
    id: 'parc_100',
    userId: USUARIO_PRODUCTOR.id,
  };

  it('permite el acceso si el usuario es el dueño legítimo de la parcela (PROPIETARIO)', () => {
    const res = evaluarAccesoParcela(USUARIO_PRODUCTOR, PARCELA_TEST.userId, false);
    assert.equal(res.permitida, true);
    assert.equal(res.motivo, 'PROPIETARIO');
  });

  it('permite el acceso si el usuario es un técnico extensionista con acceso otorgado por el productor (TECNICO_ASOCIADO)', () => {
    const res = evaluarAccesoParcela(USUARIO_TECNICO, PARCELA_TEST.userId, true);
    assert.equal(res.permitida, true);
    assert.equal(res.motivo, 'TECNICO_ASOCIADO');
  });

  it('rechaza el acceso si el usuario es técnico pero el productor no le otorgó acceso (FORBIDDEN)', () => {
    const res = evaluarAccesoParcela(USUARIO_TECNICO, PARCELA_TEST.userId, false);
    assert.equal(res.permitida, false);
    assert.equal(res.motivo, 'FORBIDDEN');
    assert.equal(res.error, 'Parcela no encontrada', 'Debe evitar enumeración de parcelas');
  });

  it('rechaza el acceso si un usuario no técnico intenta acceder a parcela ajena aun con flag de asociación activo', () => {
    const res = evaluarAccesoParcela(USUARIO_AJENO, PARCELA_TEST.userId, true);
    assert.equal(res.permitida, false);
    assert.equal(res.motivo, 'FORBIDDEN');
  });

  it('rechaza el acceso a un usuario ajeno sin relación con la parcela', () => {
    const res = evaluarAccesoParcela(USUARIO_AJENO, PARCELA_TEST.userId, false);
    assert.equal(res.permitida, false);
    assert.equal(res.motivo, 'FORBIDDEN');
  });

  it('garantiza anti-enumeración respondiendo exactamente el mismo mensaje que si la parcela no existiera', () => {
    const resAjeno = evaluarAccesoParcela(USUARIO_AJENO, PARCELA_TEST.userId, false);
    const resTecnicoNoAsociado = evaluarAccesoParcela(USUARIO_TECNICO, PARCELA_TEST.userId, false);

    assert.equal(resAjeno.error, 'Parcela no encontrada');
    assert.equal(resTecnicoNoAsociado.error, 'Parcela no encontrada');
  });
});
