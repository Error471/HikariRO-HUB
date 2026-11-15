/**
 * Copia texto al portapapeles. La app de escritorio deniega los permisos del navegador, y con ellos
 * `navigator.clipboard`; por eso, si falla, se recurre a copiar desde un campo de texto oculto, que
 * no necesita permiso cuando responde a un clic. Devuelve si se pudo copiar.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithSelection(text);
  }
}

function copyWithSelection(text: string): boolean {
  const previous = document.activeElement;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '0';
  field.style.opacity = '0';
  document.body.appendChild(field);
  try {
    field.focus();
    field.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    if (previous instanceof HTMLElement) previous.focus();
  }
}
