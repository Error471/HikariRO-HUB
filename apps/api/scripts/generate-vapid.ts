import webpush from 'web-push';

// Genera un par de claves VAPID para los avisos push. Cópialas en .env.
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:tu-correo@example.com');
