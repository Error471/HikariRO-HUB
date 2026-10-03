import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiscordMarkdown } from './DiscordMarkdown';

describe('DiscordMarkdown', () => {
  it('no interpreta HTML del contenido externo', () => {
    const { container } = render(
      <DiscordMarkdown content={'<img src=x onerror="alert(1)"> <script>alert(1)</script>'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
  });

  it('solo convierte en enlace las URLs http(s)', () => {
    render(<DiscordMarkdown content={'[malo](javascript:alert(1)) y https://hikariro.com/wiki'} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://hikariro.com/wiki');
    expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renderiza formato, cabeceras y listas de Discord', () => {
    render(
      <DiscordMarkdown
        content={'@everyone\n# Título\nTexto con **negrita** y `código`\n- uno\n- dos <@123>'}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument();
    expect(screen.getByText('negrita').tagName).toBe('STRONG');
    expect(screen.getByText('código').tagName).toBe('CODE');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(document.body.textContent).not.toContain('@everyone');
    expect(document.body.textContent).not.toContain('<@123>');
  });

  it('indica cuando la publicación no tiene texto', () => {
    render(<DiscordMarkdown content="" />);
    expect(screen.getByText('Publicación sin texto.')).toBeInTheDocument();
  });
});
