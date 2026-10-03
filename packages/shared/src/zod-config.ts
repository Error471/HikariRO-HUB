import { z } from 'zod';

/**
 * Los mensajes por defecto de Zod son técnicos y en inglés. Los esquemas que necesitan
 * un texto concreto lo definen; el resto muestra un mensaje genérico en español.
 */
z.config({ customError: () => 'Revisa los datos introducidos.' });
