# Deploiement VPS Docker

Ce deploiement lance la partie web/API Next.js de Fileo dans Docker et garde
Supabase comme service externe pour Auth, PostgreSQL et Storage.

Le mode initial fonctionne sans nom de domaine : Caddy ecoute sur `http://IP_DU_VPS`
et redirige vers le conteneur Next.js. Quand un domaine sera disponible, Caddy
gerera HTTPS automatiquement.

## 1. Preparer le VPS

Sur Ubuntu/Debian :

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Ouvrir les ports :

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Recuperer le code depuis GitHub

```bash
cd /opt
sudo git clone https://github.com/marielevha/Fileo.git fileo
sudo chown -R "$USER":"$USER" /opt/fileo
cd /opt/fileo
git checkout main
```

Pour mettre a jour plus tard :

```bash
cd /opt/fileo
git pull origin main
docker compose --env-file .env.production up -d --build
```

## 3. Creer l'environnement production

```bash
cp .env.production.example .env.production
nano .env.production
```

Renseigner au minimum :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=http://IP_DU_VPS`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_POOLER_DB_URL` ou `SUPABASE_DB_URL`
- `SUPABASE_STORAGE_PRIVATE_BUCKET`
- `NEXT_PUBLIC_APP_URL=http://IP_DU_VPS`

Important : les variables `NEXT_PUBLIC_*` sont utilisees pendant le build Docker.
Il faut donc reconstruire l'image apres les avoir modifiees.

## 4. Lancer Fileo

```bash
docker compose --env-file .env.production up -d --build
```

Le premier build peut prendre plusieurs minutes : Next.js telecharge aussi les
polices configurees avec `next/font`.

Verifier :

```bash
docker compose ps
docker compose logs -f fileo-web
curl http://IP_DU_VPS/api/mobile/v1/health
```

Acceder ensuite a :

```text
http://IP_DU_VPS
```

L'API mobile sera disponible sous :

```text
http://IP_DU_VPS/api/mobile/v1
```

## 5. Quand le domaine sera disponible

Faire pointer le DNS du domaine ou sous-domaine vers l'IP du VPS, puis remplacer
le contenu de `Caddyfile` par exemple :

```caddyfile
app.fileo.example {
	reverse_proxy fileo-web:3000
}
```

Relancer Caddy :

```bash
docker compose up -d caddy
```

Caddy demandera et renouvellera automatiquement le certificat HTTPS.

Mettre ensuite `NEXT_PUBLIC_APP_URL=https://app.fileo.example` dans
`.env.production`, reconstruire, puis relancer :

```bash
docker compose --env-file .env.production up -d --build
```

Une fois la branche de deploiement stabilisee, un script peut faire la mise a
jour courante :

```bash
APP_DIR=/opt/fileo BRANCH=main sh scripts/deploy-vps.sh
```

Pendant les tests Docker depuis une branche dediee :

```bash
APP_DIR=/opt/fileo BRANCH=feature/docker-vps-deploy sh scripts/deploy-vps.sh
```

## 6. Commandes utiles

```bash
docker compose ps
docker compose logs -f
docker compose restart fileo-web
docker compose down
docker compose --env-file .env.production up -d --build
```

## 7. Notes importantes

- Ne jamais committer `.env.production`.
- Supabase reste externe : ne pas lancer de Postgres local pour Fileo sur ce
  VPS.
- Sans domaine, le site sera en HTTP. Certaines fonctionnalites navigateur tres
  strictes peuvent demander HTTPS ; le passage au domaine reglera ce point.
