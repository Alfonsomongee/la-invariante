---
agente: auditor
version: 1.0.0
adr: docs/decisiones/0002-prompts-agentes-v1.md
---

# Especificación — Agente Auditor de Cobertura

El agente **Auditor** es un script determinista sin LLM (`agents/auditor/index.ts`) que analiza el conjunto del archivo (`content/`) para medir cobertura y detectar huecos sin introducir sesgo artificial.

## Regla dura

**Los huecos generan búsquedas, nunca fichas.** El Auditor nunca recomienda relajar criterios editoriales para equilibrar partidos ni categorías.

## Salidas del informe de cobertura

1. Distribución de fichas, promesas y votaciones por año (1977–actual), por categoría (14 códigos), por partido, por nivel territorial (`estatal`, `autonomico`, `local`) y por estado procesal.
2. Balance de **Contraprueba** por año y serie cuantitativa.
3. Detección de años pendientes sin anuario, categorías vacías en años iniciados, fichas con `sha256: pendiente` o en `borrador` prolongado y causas abiertas pendientes de revisión del Vigilante.
4. Cola priorizada de comandos de recolección (`npm run agent -- recolector ...`) para cubrir huecos documentales verificables.
