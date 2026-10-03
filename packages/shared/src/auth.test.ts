import { describe, expect, it } from 'vitest';
import { loginRequestSchema } from './auth.js';

describe('loginRequestSchema', () => {
  it('recorta el usuario pero conserva la contraseña tal cual', () => {
    const parsed = loginRequestSchema.parse({ username: '  ivan ', password: ' secreto ' });
    expect(parsed).toEqual({ username: 'ivan', password: ' secreto ' });
  });

  it('rechaza campos vacíos', () => {
    expect(loginRequestSchema.safeParse({ username: ' ', password: '' }).success).toBe(false);
  });

  it('rechaza entradas excesivamente largas', () => {
    const result = loginRequestSchema.safeParse({ username: 'a'.repeat(33), password: 'x' });
    expect(result.success).toBe(false);
  });
});
