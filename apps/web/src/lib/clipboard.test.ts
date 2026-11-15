import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('usa el portapapeles del navegador cuando está permitido', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    await expect(copyText('Baphomet')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('Baphomet');
  });

  it('si el permiso está denegado, copia desde un campo oculto y lo retira', async () => {
    stubClipboard(() => Promise.reject(new DOMException('denegado', 'NotAllowedError')));
    let copied = '';
    document.execCommand = vi.fn(() => {
      copied = (document.activeElement as HTMLTextAreaElement).value;
      return true;
    });
    await expect(copyText('Amon Ra')).resolves.toBe(true);
    expect(copied).toBe('Amon Ra');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('devuelve false si no hay forma de copiar', async () => {
    stubClipboard(() => Promise.reject(new Error('denegado')));
    document.execCommand = vi.fn(() => false);
    await expect(copyText('Drake')).resolves.toBe(false);
  });
});
