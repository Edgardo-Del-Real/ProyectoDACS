import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('no renderiza nada cuando open es false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Eliminar Parcela"
        description="¿Estás seguro de eliminar esta parcela?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza título, descripción y botones cuando open es true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Eliminar Parcela"
        description="Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        cancelLabel="Volver"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Eliminar Parcela')).toBeInTheDocument();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('dispara onConfirm al hacer clic en el botón de confirmación', () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirmar acción"
        description="Descripción"
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('dispara onCancel al hacer clic en el botón de cancelar', () => {
    const handleCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirmar acción"
        description="Descripción"
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('dispara onCancel al presionar la tecla Escape', () => {
    const handleCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirmar acción"
        description="Descripción"
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('deshabilita los botones y muestra estado ocupado cuando busy es true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirmar acción"
        description="Descripción"
        busy={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: 'Procesando...' });
    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });

    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
  });
});
