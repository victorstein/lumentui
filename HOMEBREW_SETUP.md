# 🍺 Homebrew Distribution Guide for LumentuiAPI

**Actualizado:** 2026-02-02  
**Versión:** 1.1.0  
**Estado:** ✅ LISTO (requires npm publish)

---

## 📋 Checklist - Requisitos

### ✅ Ya Tienes (Estado Actual)

- [x] **Git Repository**: https://github.com/victorstein/lumentui.git
- [x] **package.json configurado**:
  - `name: "lumentui"`
  - `version: "1.1.0"`
  - `bin: {"lumentui": "./dist/cli.js"}`
  - `repository` configurado
- [x] **CLI compilado**: `dist/cli.js` con shebang `#!/usr/bin/env node`
- [x] **README.md** con instalación y uso
- [x] **LICENSE** (verificar que existe)

### ❌ Falta Hacer

- [ ] **Publicar a npm**: `npm publish` (requisito para Homebrew)
- [ ] **Crear Homebrew Formula**
- [ ] **Crear tap personal** (opcional pero recomendado)
- [ ] **Configurar versioning/releases** en GitHub

---

## 🎯 Opción 1: Homebrew Official (Difícil, Lento)

**Pros:**

- Más prestigio
- Instalable con `brew install lumentui`

**Cons:**

- Requisitos estrictos (500+ stars, popularidad, mantenimiento)
- Review process largo (~semanas)
- No aceptan todas las apps

**Proceso:**

1. Publicar a npm con `npm publish`
2. Crear GitHub release con tag `v1.1.0`
3. Crear PR a [homebrew-core](https://github.com/Homebrew/homebrew-core)
4. Esperar review (puede ser rechazado)

**Veredicto:** ❌ **NO RECOMENDADO para v1** - es overkill para uso personal

---

## 🚀 Opción 2: Homebrew Tap Personal (Recomendado)

**Pros:**

- Control total
- Deploy inmediato
- No requiere review externo
- Instalable con `brew install victorstein/lumentui/lumentui`

**Cons:**

- Requiere repo adicional
- Usuarios deben agregar tap primero

**Proceso:**

### Paso 1: Publicar a npm (OBLIGATORIO)

Homebrew necesita instalar desde npm (o tarball):

```bash
cd ~/clawd/development/lumentui

# 1. Asegúrate de estar logueado en npm
npm login

# 2. Verifica que todo esté listo
npm run build
npm pack --dry-run

# 3. Publica
npm publish

# Si el nombre está tomado, puedes usar scope:
npm publish --access public
```

**Resultado:** `https://www.npmjs.com/package/lumentui`

---

### Paso 2: Crear GitHub Release

```bash
cd ~/clawd/development/lumentui

# 1. Tag la versión
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0

# 2. Crea release en GitHub UI o con gh CLI:
gh release create v1.1.0 \
  --title "LumentuiAPI v1.1.0" \
  --notes "Initial release" \
  --latest
```

**Resultado:** https://github.com/victorstein/lumentui/releases/tag/v1.1.0

---

### Paso 3: Crear Homebrew Tap Repository

```bash
# 1. Crea nuevo repo en GitHub: "homebrew-lumentui"
gh repo create victorstein/homebrew-lumentui --public

# 2. Clónalo
mkdir -p ~/brew-tap
cd ~/brew-tap
git clone https://github.com/victorstein/homebrew-lumentui.git
cd homebrew-lumentui

# 3. Crea la formula
mkdir -p Formula
```

---

### Paso 4: Crear Formula (lumentui.rb)

Crea `Formula/lumentui.rb`:

```ruby
class Lumentui < Formula
  desc "Elegant product monitoring for shop.lumenalta.com with macOS notifications"
  homepage "https://github.com/victorstein/lumentui"
  url "https://registry.npmjs.org/lumentui/-/lumentui-1.1.0.tgz"
  sha256 "REPLACE_WITH_ACTUAL_SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/lumentui", "--version"
  end
end
```

**Para obtener el SHA256:**

```bash
# Opción A: Desde npm
curl -L https://registry.npmjs.org/lumentui/-/lumentui-1.1.0.tgz | shasum -a 256

# Opción B: Desde local tarball
npm pack
shasum -a 256 lumentui-1.1.0.tgz
```

---

### Paso 5: Push Formula

```bash
cd ~/brew-tap/homebrew-lumentui

git add Formula/lumentui.rb
git commit -m "Add lumentui formula v1.1.0"
git push origin main
```

**Resultado:** https://github.com/victorstein/homebrew-lumentui

---

### Paso 6: Testear Instalación

```bash
# 1. Agregar tap
brew tap victorstein/lumentui

# 2. Instalar
brew install victorstein/lumentui/lumentui

# 3. Verificar
lumentui --version
lumentui --help
```

---

## 🔄 Actualizaciones Futuras

Cuando lances v1.0.1, v1.1.0, etc:

```bash
# 1. Publica nueva versión a npm
cd ~/clawd/development/lumentui
npm version patch  # o minor, major
npm publish
git push --tags

# 2. Actualiza formula
cd ~/brew-tap/homebrew-lumentui
vim Formula/lumentui.rb

# Cambiar:
# - url: versión nueva
# - sha256: nuevo hash (curl -L ... | shasum -a 256)

git add Formula/lumentui.rb
git commit -m "lumentui: update to v1.0.1"
git push

# 3. Usuarios actualizan con:
brew upgrade lumentui
```

---

## 📦 Opción 3: Distribución sin npm (No Recomendado)

Si NO quieres publicar a npm público, puedes usar GitHub releases como fuente:

```ruby
class Lumentui < Formula
  desc "..."
  homepage "..."
  url "https://github.com/victorstein/lumentui/archive/refs/tags/v1.1.0.tar.gz"
  sha256 "..."
  license "MIT"

  depends_on "node"

  def install
    # Instalar deps y compilar
    system "npm", "ci"
    system "npm", "run", "build"

    # Copiar archivos necesarios
    libexec.install Dir["*"]

    # Crear wrapper script
    (bin/"lumentui").write <<~EOS
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/dist/cli.js" "$@"
    EOS
  end

  test do
    system "#{bin}/lumentui", "--version"
  end
end
```

**Cons:**

- Cada instalación compila desde source (más lento)
- Requiere npm install en máquina del usuario
- Más propenso a errores

---

## 🎯 Recomendación Final

**Para uso personal/privado:**

✅ **Opción 2 (Tap Personal)** es la mejor:

1. Publicas a npm (gratuito, infinitas descargas)
2. Creas tap en 10 minutos
3. Instalación simple: `brew install victorstein/lumentui/lumentui`

**Pasos mínimos:**

```bash
# 1. Publish
cd ~/clawd/development/lumentui
npm publish

# 2. Create tap repo
gh repo create victorstein/homebrew-lumentui --public
git clone https://github.com/victorstein/homebrew-lumentui.git ~/brew-tap/homebrew-lumentui

# 3. Create formula (copy template above)
cd ~/brew-tap/homebrew-lumentui
mkdir -p Formula
# [Crear Formula/lumentui.rb con contenido de arriba]

# 4. Get SHA256
curl -L https://registry.npmjs.org/lumentui/-/lumentui-1.1.0.tgz | shasum -a 256

# 5. Update SHA in formula y push
git add Formula/lumentui.rb
git commit -m "Add lumentui formula v1.1.0"
git push

# 6. Test
brew tap victorstein/lumentui
brew install lumentui
```

**Tiempo total:** ~30 minutos

---

## 📝 Notas Adicionales

### Dependencies Runtime

LumenTUI now uses sql.js (WASM SQLite), so no native dependencies are required:

```ruby
depends_on "node"
# No SQLite dependency needed - sql.js is WASM-based
```

### Caveats (Avisos post-instalación)

```ruby
def caveats
  <<~EOS
    LumentuiAPI requires configuration before use:

    1. Set up authentication:
       $ lumentui login

    2. Configure macOS notifications in:
       ~/.lumentui/.env

    3. Start monitoring:
       $ lumentui start

    For more info: https://github.com/victorstein/lumentui
  EOS
end
```

### Formula Auto-generación

Homebrew CLI puede generar formula base:

```bash
brew create https://registry.npmjs.org/lumentui/-/lumentui-1.1.0.tgz
```

---

**¿Listo para empezar?** El primer paso es `npm publish` 🚀
