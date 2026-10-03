# Despliegue gratuito: GitHub + Oracle Cloud Always Free

Coste: 0 €. El código vive en GitHub (repositorio privado) y la app se ejecuta en una VM gratuita de Oracle Cloud con el mismo `docker-compose.yml` del proyecto (Caddy + API + Redis). GitHub Actions comprueba cada cambio y, si lo activas, despliega solo.

> **Por qué no solo GitHub:** GitHub Pages solo sirve archivos estáticos. La API tiene que estar encendida siempre para hacer el login en HikariRO, guardar las sesiones y mandar los avisos de MVP.

Tiempo estimado: 45–60 min la primera vez.

---

## 0. Lo que necesitas

- Cuenta de **GitHub**.
- Cuenta de **Oracle Cloud** (pide tarjeta para verificar identidad; no cobra si no sales de los recursos Always Free).
- Cuenta de **DuckDNS** (gratis, entras con GitHub) para tener un dominio tipo `mi-companion.duckdns.org`.
- En tu PC: Git y Node 22 (ya los tienes para desarrollar).

## 1. Sube el código a GitHub

En PowerShell, dentro de la carpeta `hikariro-companion`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publicar-en-github.ps1
```

El script:

1. Instala GitHub CLI si falta (con `winget`).
2. Te pide iniciar sesión en GitHub **en tu navegador** (copias un código y autorizas). Tu contraseña de GitHub nunca pasa por el script.
3. Crea el repositorio local y comprueba que `.env` **no** se sube; si algún archivo con secretos fuera a subirse, se para.
4. Crea el repositorio **privado** `hikariro-companion` en tu cuenta y sube el código.

Se puede volver a ejecutar para subir cambios. En la pestaña **Actions** del repositorio verás la CI: formato, lint, tipos, tests, build, tests e2e con Playwright y build de las imágenes Docker para ARM.

## 2. Crea la VM en Oracle Cloud

1. **Compute → Instances → Create instance**.
2. **Image:** Canonical Ubuntu 24.04.
3. **Shape:** `VM.Standard.A1.Flex` (Ampere, ARM) con **1 OCPU y 6 GB** (sobra; el límite gratuito es 2 OCPU y 12 GB en total).
   - Si sale _Out of capacity_, prueba otro _Availability Domain_ o inténtalo más tarde.
4. **Networking:** deja la VCN por defecto con IP pública.
5. **SSH keys:** descarga la clave privada (`.key`) y guárdala bien.
6. Crea la instancia y apunta su **IP pública**.

Para que la IP no cambie: **Networking → Reserved public IPs → Reserve**, y asígnala a la VNIC de la instancia (gratis mientras esté en uso).

### Evita que Oracle recupere la VM

Oracle puede recuperar las VM _Always Free_ que considera inactivas: si durante 7 días la CPU (percentil 95), la red y la memoria están por debajo del 20 %. Esta app consume muy poco, así que es probable que pase.

La solución es **pasar la cuenta a Pay As You Go**: sigues sin pagar mientras no salgas de los recursos Always Free, y esas instancias ya no se recuperan. Hazlo en **Billing → Upgrade and Manage Payment**, y crea justo después un **presupuesto con alerta a 1 €** en **Billing → Budgets** para enterarte si algo empieza a costar dinero.

### Abre los puertos 80 y 443

En Oracle hay dos cortafuegos:

1. **Security List** de la subred (**Networking → Virtual cloud networks → tu VCN → Security Lists → Default**) → **Add Ingress Rules**:
   - Source `0.0.0.0/0`, TCP, puerto `80`.
   - Source `0.0.0.0/0`, TCP, puerto `443`.
   - Source `0.0.0.0/0`, UDP, puerto `443` (HTTP/3, opcional).
2. **iptables** dentro de la VM (paso 4).

## 3. Dominio gratis con DuckDNS

1. Entra en [duckdns.org](https://www.duckdns.org) y crea un subdominio, p. ej. `mi-companion`.
2. En el campo _current ip_ pon la **IP pública reservada** de la VM y pulsa _update ip_.

Tu dominio será `mi-companion.duckdns.org`. Caddy obtendrá el certificado HTTPS automáticamente.

## 4. Prepara la VM

Conéctate desde PowerShell (ajusta la ruta de la clave y la IP):

```powershell
ssh -i C:\ruta\a\tu-clave.key ubuntu@IP_DE_LA_VM
```

Dentro de la VM:

```bash
# Puertos web en el cortafuegos de Ubuntu (las imágenes de Oracle bloquean todo por defecto)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```

Vuelve a conectarte por SSH para que se aplique el grupo `docker`.

## 5. Descarga el código en la VM

Como el repositorio es privado, crea una **deploy key** de solo lectura:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "hikariro-vm"
cat ~/.ssh/github_deploy.pub
```

En GitHub: **Settings → Deploy keys → Add deploy key**, pega la clave pública y deja **sin marcar** _Allow write access_.

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
EOF
git clone git@github.com:TU_USUARIO/hikariro-companion.git
cd hikariro-companion
```

## 6. Configura `.env` en el servidor

Primero, **en tu PC**, genera las claves de los avisos push:

```powershell
pnpm --filter @hrc/api vapid
```

En la VM:

```bash
cp .env.example .env
nano .env
```

Valores a cambiar:

| Variable                                                 | Valor                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV`                                               | `production`                                                                 |
| `DOMAIN`                                                 | `mi-companion.duckdns.org` (quita el `#`)                                    |
| `APP_ORIGIN`                                             | `https://mi-companion.duckdns.org`                                           |
| `SESSION_SECRET`                                         | salida de `openssl rand -base64 48`                                          |
| `SESSION_ENCRYPTION_KEY`                                 | salida de `openssl rand -base64 32`                                          |
| `COOKIE_SECURE`                                          | `true`                                                                       |
| `HIKARI_USER_AGENT`                                      | `HikariRO-Companion/1.0 (+https://mi-companion.duckdns.org)`                 |
| `PRIVACY_CONTACT`                                        | tu correo o usuario de Discord (se muestra en `/privacidad`)                 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | las tres líneas que generaste en tu PC (cambia el correo de `VAPID_SUBJECT`) |

`REDIS_URL`, `TRUST_PROXY` y el puerto los fija `docker-compose.yml`; no hace falta tocarlos. Protege el archivo:

```bash
chmod 600 .env
```

Usa **secretos nuevos**, distintos de los de tu `.env` de desarrollo.

## 7. Arranca

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

La primera build tarda unos minutos. Después abre `https://mi-companion.duckdns.org`.

**Prueba lo primero el login con tu cuenta.** HikariRO está detrás de Cloudflare y las IP de centros de datos a veces reciben un desafío anti-bot. Si la app dice _"HikariRO está bloqueando las peticiones"_ (`UPSTREAM_BLOCKED` en los logs), mira _Problemas frecuentes_.

## 8. Instala la app y activa los avisos

- **Android / Chrome / Edge:** abre la web → menú → _Instalar aplicación_.
- **iPhone / iPad (iOS 16.4+):** Safari → _Compartir_ → _Añadir a pantalla de inicio_, y abre la app desde el icono. Fuera de la app instalada, iOS no permite avisos push.

Después: **MVP Timer → marca tus MVPs con la estrella → Avisos → Activar en este dispositivo → Enviar aviso de prueba**.

Los avisos usan tu sesión del Companion. Si pasas más de 2 días sin abrir la app, la sesión caduca, los avisos se pausan y recibes una notificación para volver a entrar.

## 9. Despliegue automático (opcional)

Con esto, cada `git push` a `main` que pase la CI se despliega solo.

1. En **tu PC** crea un par de claves solo para GitHub Actions:

   ```powershell
   ssh-keygen -t ed25519 -f $HOME\.ssh\hikariro_actions -N '""' -C "github-actions"
   ```

2. Añade la clave **pública** a la VM:

   ```bash
   echo "CONTENIDO_DE_hikariro_actions.pub" >> ~/.ssh/authorized_keys
   ```

3. En GitHub → **Settings → Secrets and variables → Actions**:
   - **Secrets:** `DEPLOY_HOST` (IP o dominio), `DEPLOY_USER` (`ubuntu`) y `DEPLOY_SSH_KEY` (contenido de la clave **privada** `hikariro_actions`).
   - **Variables:** `DEPLOY_ENABLED` = `true`.
4. En **Settings → Environments** crea `production`. Si quieres aprobar cada despliegue a mano, añade _Required reviewers_.

Los secretos van solo en GitHub. Nunca los pegues en un chat, issue o commit.

## 10. Copias de seguridad

Redis guarda los favoritos y los dispositivos con avisos, con persistencia AOF en el volumen `redis_data`. Las sesiones no necesitan copia: si se pierden, basta con volver a entrar.

Copia semanal en la VM (`crontab -e`):

```cron
0 5 * * 1 cd ~/hikariro-companion && docker compose exec -T redis redis-cli BGSAVE && sleep 10 && mkdir -p ~/backups && docker run --rm -v hikariro-companion_redis_data:/data:ro -v ~/backups:/backup alpine tar czf /backup/redis-$(date +\%F).tgz -C /data . && find ~/backups -name 'redis-*.tgz' -mtime +60 -delete
```

## 11. Mantenimiento

| Tarea                     | Comando                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Actualizar a mano         | `git pull && docker compose up -d --build`                                                                                       |
| Ver logs                  | `docker compose logs -f api` / `docker compose logs -f web`                                                                      |
| Reiniciar                 | `docker compose restart`                                                                                                         |
| Liberar espacio           | `docker image prune -f` y `docker builder prune -f`                                                                              |
| Cerrar todas las sesiones | `docker compose exec -T redis redis-cli --scan --pattern 'hrc:session:*' \| xargs -r docker compose exec -T redis redis-cli del` |

Ubuntu instala las actualizaciones de seguridad solo (`unattended-upgrades`). Reinicia la VM de vez en cuando con `sudo reboot`; los contenedores vuelven solos (`restart: unless-stopped`).

## Problemas frecuentes

| Síntoma                                     | Causa y solución                                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La web no carga                             | Revisa la Security List, las reglas de iptables (paso 4) y que DuckDNS apunte a la IP correcta.                                                                                                     |
| Error de certificado                        | Caddy necesita el puerto 80 abierto y el dominio apuntando a la VM. Mira `docker compose logs web`.                                                                                                 |
| `UPSTREAM_BLOCKED` al iniciar sesión        | Cloudflare desafía la IP de Oracle. Prueba otra región o IP; si sigue, la alternativa gratuita es ejecutar el mismo Docker Compose en un PC o Raspberry de casa y publicarlo con Cloudflare Tunnel. |
| `Configuración inválida` al arrancar la API | Falta o está mal una variable de `.env`; el log dice cuál.                                                                                                                                          |
| No llegan avisos                            | ¿Hay favoritos? ¿_Avisos → Enviar aviso de prueba_ funciona? En iPhone, ¿la app está instalada? En los logs: `docker compose logs api \| grep mvp-watcher`.                                         |
