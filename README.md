# EMI · Cuadernillo digital

App estática (HTML/CSS/JS, sin backend) para completar a mano, semana a
semana, el cuaderno de trabajo del curso. Todo se guarda en el
`localStorage` del navegador — no hay servidor ni base de datos.

## Cómo usarla

Abrí `index.html` en el navegador (o servila con cualquier servidor
estático, por ejemplo `npx serve .`). Funciona bien desde el celular:
agregala a la pantalla de inicio para tenerla a mano.

- Cada campo se guarda solo, unos 500ms después de dejar de tipear.
- **Exportar progreso** descarga un `.json` con todas tus respuestas —
  usalo como respaldo o para pasar tus datos a otro dispositivo.
- **Importar progreso** carga ese `.json` y reemplaza lo que tengas
  guardado en este navegador (te pide confirmación antes de pisar nada).

> Como todo vive en el `localStorage` del navegador, si limpiás datos de
> navegación o cambiás de dispositivo vas a perder el progreso salvo que
> lo hayas exportado antes.

## Cómo agregar una semana nueva

Cada semana que te llega en PDF se convierte en un archivo
`data/semana-XX.json`. El renderizador es genérico: arma la pantalla a
partir de este JSON, así que agregar una semana es solo sumar datos, sin
tocar código.

1. **Creá el archivo** `data/semana-XX.json` (usá el número que sigue,
   con dos dígitos: `semana-03.json`, `semana-04.json`, etc.).

2. **Completalo con este esquema:**

   ```json
   {
     "id": "m1-s3",
     "titulo": "M1 Cuaderno semanal 3",
     "bloques": [ /* ver tipos de bloque abajo */ ]
   }
   ```

   - `id`: identificador único de la semana (no se repite entre
     archivos). Se usa como prefijo interno para guardar las
     respuestas, así que si lo cambiás después de haber completado
     campos, esas respuestas quedan "huérfanas".
   - `titulo`: lo que se ve en el índice lateral y como encabezado de
     la semana.
   - `bloques`: lista ordenada de las secciones de esa semana.

3. **Agregá la entrada en `data/manifest.json`**, en el orden en que
   querés que aparezcan en el índice:

   ```json
   [
     { "id": "m1-s1", "archivo": "semana-01.json" },
     { "id": "m1-s2", "archivo": "semana-02.json" },
     { "id": "m1-s3", "archivo": "semana-03.json" }
   ]
   ```

4. Refrescá la página — la semana nueva aparece sola en el índice.

## Tipos de bloque disponibles

Cada bloque va dentro de `bloques` y siempre tiene `tipo` y `titulo`.

### `texto_libre`
Una pregunta con una caja de texto libre. Si tiene `subpreguntas`, se
muestra una caja de texto por cada una en vez de una sola.

```json
{
  "tipo": "texto_libre",
  "titulo": "Meditación 3",
  "pregunta": "Relata tu experiencia."
}
```

```json
{
  "tipo": "texto_libre",
  "titulo": "Clave 3",
  "pregunta": "¿Cuál es la fuente de tu inspiración?",
  "subpreguntas": [
    "¿Qué valores sociales o familiares te motivan?",
    "¿Qué te interesa naturalmente?"
  ]
}
```

### `lista_numerada`
Una pregunta con una lista de renglones numerados para completar.

```json
{
  "tipo": "lista_numerada",
  "titulo": "Desafío 3",
  "pregunta": "Identifica las cosas que activan tus aflicciones emocionales.",
  "cantidad_items": 7
}
```

### `checkbox_semana`
Una grilla de casilleros para marcar el cumplimiento diario de una o
más prácticas durante la semana.

```json
{
  "tipo": "checkbox_semana",
  "titulo": "Registra tu progreso",
  "filas": ["Reflexión 3", "Meditación 3", "Evaluación 3"],
  "dias": ["L", "M", "M", "J", "V", "S", "D"]
}
```

### `tabla`
Una tabla libre con columnas fijas. `filas` acepta dos formas:

- **Un número**: esa cantidad de filas en blanco, con todas las
  columnas editables (por ejemplo, un horario libre).

  ```json
  {
    "tipo": "tabla",
    "titulo": "Clave 1",
    "pregunta": "Desarrolla tu ritual matinal.",
    "columnas": ["Hora", "Actividad"],
    "filas": 8
  }
  ```

- **Un array de etiquetas**: una fila fija por etiqueta (por ejemplo,
  los días de la semana), con esa etiqueta de solo lectura en la
  primera columna y las columnas editables al lado.

  ```json
  {
    "tipo": "tabla",
    "titulo": "Clave 3",
    "pregunta": "Escribe el aforismo que tendrás presente cada día.",
    "columnas": ["Aforismo"],
    "filas": ["Sábado", "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
  }
  ```

### Agregar un tipo de bloque nuevo

Si algún PDF trae un formato de pregunta que no entra en los cuatro
tipos de arriba, se agrega un tipo nuevo sin tocar el resto de la app:

1. En `js/app.js`, sumá una función nueva al objeto
   `RENDERERS_DE_BLOQUE` (buscá ese nombre en el archivo) que reciba
   `(bloque, semanaId, indiceBloque)` y devuelva el elemento del DOM a
   mostrar. Los campos editables que crees ahí deben usar
   `crearCampoTextarea`, `crearCampoInput` o `crearCampoCheckbox` (o
   llevar la clase `campo` y un `data-key` único) para que el
   autoguardado y el contador de progreso los detecten solos.
2. Usá ese `tipo` nuevo en el JSON de la semana que corresponda.

El resto del código (guardado, exportar/importar, progreso, índice
lateral) no necesita cambios: no sabe nada de tipos de bloque
específicos.

## Estructura de archivos

```
index.html          shell de la app + índice lateral
css/style.css        estilos
js/app.js            renderizado genérico, autoguardado, export/import
data/manifest.json   lista ordenada de semanas disponibles
data/semana-01.json  contenido de la semana 1
data/semana-02.json  contenido de la semana 2
data/semana-03.json  contenido de la semana 3
```
