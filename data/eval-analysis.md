# Análisis de calidad de búsqueda NCM

## Resumen ejecutivo

- **73% acierto total** (47% NCM exacto + 27% capítulo correcto)
- **27% miss** (8 de 30 queries no encontraron nada relevante)
- La **semántica es la capa que más trabaja** pero tiene problemas de precisión
- El **trigram genera mucho ruido** (72 resultados, solo 29% correctos)
- El **fulltext casi no dispara** (1 resultado en 30 queries)

## Análisis por capa

### Catálogo: 100% precisión, 1 resultado
- Solo disparó para LATTAFA (que estaba pre-cargado)
- **Conclusión**: Funciona perfecto, pero depende de datos históricos

### Full-text (tsvector): 100% precisión, 1 resultado
- Solo matcheó "aceite de oliva" → "Aceite de oliva"
- **Problema**: El vocabulario del usuario ("perfume", "mouse") no coincide con
  el vocabulario formal del NCM ("extractos de perfumería", "unidades de entrada")
- El stemming español ayuda poco cuando las palabras raíz son completamente distintas
- **Conclusión**: Útil solo cuando el usuario usa exactamente las mismas palabras del NCM

### Trigram (pg_trgm): 29% precisión, 72 resultados — PROBLEMÁTICA
- Genera MUCHOS falsos positivos por coincidencia de caracteres
- Ejemplos de fallos:
  - "tornillos de acero inoxidable" → matcheó "Alambre de acero inoxidable" (53% sim)
    en vez de "Tornillos" porque "acero inoxidable" tiene más caracteres
  - "telas de algodón" → matcheó genérico en vez del código correcto
  - "pintura latex" → matcheó "laminados planos de acero" (15% sim!) — basura
- **Problema**: Trigram matchea substrings sin entender contexto.
  El material ("acero inoxidable") domina sobre el producto ("tornillos")
- **Conclusión**: Threshold de 0.15 es MUY bajo. Necesita mínimo 0.4 o eliminar

### Semántica (embeddings): 44% precisión, 96 resultados — MEJOR CAPA
- Encontró 14 NCM exactos de 30 queries
- La query expansion AYUDÓ en 14 casos y no ayudó en 8
- **Problemas cuando falla:**
  - "cable USB" → matcheó "Cables de filamentos artificiales" (textiles)
  - "ibuprofeno" → matcheó "Pasta química de madera"
  - "mouse inalámbrico" → 0 resultados (no pasó el threshold)
- **Causa**: El modelo local (e5-base 768d) no tiene suficiente conocimiento
  del mundo para conectar "mouse" con "unidad de entrada" o "ibuprofeno" con
  "medicamento"
- **Conclusión**: Es la mejor capa pero necesita un modelo más potente

## Análisis de la query expansion

| Métrica | Valor |
|---------|-------|
| Ayudó (semántica encontró) | 14/30 (47%) |
| Neutral (otra capa encontró) | 8/30 (27%) |
| No ayudó (miss) | 8/30 (27%) |

La expansion es **net positiva**: sin ella la semántica no habría encontrado esos
14 resultados. El problema NO es la expansion en sí — es que el modelo de embeddings
no es lo suficientemente bueno para cerrar la brecha vocabulario-consumidor → vocabulario-aduanero.

## Diagnóstico de los 8 misses

| Query | Problema |
|-------|----------|
| mouse inalámbrico | Modelo no conecta "unidad de entrada" con NCM 8471 |
| cable USB tipo C | Confunde cable eléctrico con cable textil (filamentos) |
| remeras de poliéster | Trigram matcheó tejido de punto en vez de prenda |
| tornillos de acero inoxidable | Trigram priorizó "acero inoxidable" sobre "tornillos" |
| pintura latex | Trigram basura (15% sim) — threshold muy bajo |
| ibuprofeno | Modelo no tiene conocimiento farmacéutico |
| alcohol en gel | Confunde alcohol químico con producto de higiene |
| muñeca Barbie | Matcheó "muebles de plástico" en vez de juguetes |

## Recomendaciones

### 1. Subir threshold de trigram de 0.15 → 0.40
Elimina la basura. Los resultados de trigram <0.30 son prácticamente todos incorrectos.

### 2. Agregar Capa 5: Clasificación directa con Claude
Para los casos donde ninguna capa encuentra nada bueno (similarity < 0.85),
pedirle a Claude directamente que sugiera códigos NCM. Es la solución más precisa
para cerrar la brecha semántica. Costo: ~$0.002 por query con Haiku.

### 3. El full-text necesita buscar también con el query expandido
Actualmente busca solo con el query original. Si buscamos también con el expandido
("Unidad de entrada para máquinas de procesamiento de datos"), el tsvector podría
matchear "máquinas" y "procesamiento" y "datos" en las descripciones NCM.

### 4. La combinación debería ser ponderada, no por prioridad fija
Cuando trigram encuentra "Alambre de acero inoxidable" (53%) y semántica
no encontró nada, eso no significa que trigram sea correcto. Debería haber
un score mínimo de confianza por capa.
