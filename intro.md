# Arkos SSH Copilot (MVP)

## 🧠 Objetivo

Construir una CLI llamada `arkos-ssh` que permita:

- Abrir una sesión SSH normal (como `ssh user@host`)
- Mantener una **terminal real (PTY)**
- Permitir que:
  - el usuario escriba comandos
  - un agente (Claude vía MCP) también escriba comandos
- Ambos (usuario + agente) vean el mismo output en tiempo real

---

## 🚀 Concepto clave

Esto NO es un executor de comandos.

Es:

> Una **terminal compartida (shared PTY)** entre humano y agente.

---

## 🧱 Arquitectura

```

Usuario (stdin)
↓
PTY (node-pty)
↓
SSH
↓
VPS

PTY output:
→ Usuario (stdout)
→ Agente (MCP context)

````

---

## ⚙️ Requerimientos del MVP

### 1. CLI básica

Comando:

```bash
arkos-ssh user@host
````

Debe comportarse igual que:

```bash
ssh user@host
```

---

### 2. Usar PTY real

Usar `node-pty` para ejecutar SSH:

* Debe soportar:

  * colores ANSI
  * programas interactivos (`vim`, `nano`, `top`)
  * resize de terminal

---

### 3. Input/output compartido

#### Usuario → PTY

* Todo lo que escribe el usuario va al PTY

#### PTY → Usuario

* Todo el output se muestra en consola

#### PTY → Agente

* Todo el output se envía a un handler (`sendToAgent`)

#### Agente → PTY

* El agente puede ejecutar comandos escribiendo en el PTY

---

### 4. Buffer de contexto para agente

Mantener un buffer circular:

* últimas 50–200 líneas
* últimos comandos ejecutados

Formato sugerido:

```
Últimos comandos:
- docker ps
- docker logs api

Output reciente:
[últimas líneas]
```

---

### 5. API interna para agente (simulada en MVP)

Funciones:

```ts
sendToAgent(output: string): void

agentExec(command: string): void
```

---

### 6. Manejo de resize

Detectar resize de terminal:

```ts
process.stdout.on("resize", () => {
  pty.resize(cols, rows)
})
```

---

### 7. Manejo básico de concurrencia

Problema:

* usuario y agente pueden escribir al mismo tiempo

Solución MVP:

* cola simple de comandos del agente
* no bloquear input del usuario

---

## 📦 Stack técnico

* Node.js
* TypeScript
* node-pty
* child_process (opcional fallback)

---

## 🧪 MVP Scope (lo mínimo viable)

Debe soportar:

* conexión SSH básica
* ejecución de comandos
* output en tiempo real
* agente puede ejecutar comandos
* usuario puede seguir usando la terminal normalmente

NO necesario aún:

* autenticación avanzada
* multi-servidor
* UI web
* permisos
* seguridad avanzada

---

## 🧠 Diferencia vs otras soluciones

* NO es un bash executor (como Claude Code)
* NO es una GUI (como VibeShell)
* ES una capa invisible sobre SSH

---

## 🎯 Resultado esperado

Flujo:

```bash
arkos-ssh ubuntu@server
```

Luego:

* usuario ejecuta: `docker ps`
* agente ve el output
* agente ejecuta: `docker logs api`
* usuario ve el output
* ambos comparten contexto

---

## 🔮 Extensiones futuras (NO en MVP)

* integración MCP real
* multi-sesión
* permisos
* auditoría
* modo observe/suggest/execute
* integración con backend Arkos
* soporte múltiples servidores

---

## ⚠️ Consideraciones importantes

* usar PTY desde inicio (no usar spawn simple)
* no romper comportamiento estándar de SSH
* evitar bloquear stdin/stdout
* manejar correctamente escape sequences

---

## ✅ Entregables del MVP

1. CLI funcional (`arkos-ssh`)
2. conexión SSH vía PTY
3. input/output compartido
4. stub de integración con agente
5. buffer de contexto básico

---

## 💡 Nota final

El objetivo NO es reemplazar SSH.

Es:

> **extender SSH con un copiloto inteligente sin cambiar el flujo del usuario**

```
