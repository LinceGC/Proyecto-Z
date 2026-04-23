# HeyCensor (MV3)

Extensión de Chrome/Edge que intercepta imágenes en `<input type="file">`, abre un editor y aplica mosaico antes del upload.

## Activar / desactivar desde popup

En el popup hay un interruptor **"Extensión activa"** para habilitar o deshabilitar HeyCensor sin desinstalarla.

- **Activada**: intercepta inputs de imágenes y abre el editor.
- **Desactivada**: no intercepta uploads; el input funciona normal.
- El cambio aplica inmediatamente en la siguiente selección de archivo, sin recargar la página.

## Iconos (no incluidos en el repo)

Para facilitar extracción/PR sin binarios, **los PNG no se incluyen** en este repositorio.

Debes agregar manualmente estos archivos:

- `extension/icons/icon-16.png`
- `extension/icons/icon-32.png`
- `extension/icons/icon-48.png`
- `extension/icons/icon-128.png`

Luego recarga la extensión en `edge://extensions` / `chrome://extensions`.

## Cómo hacerla funcional (instalación)

1. Abre Chrome/Edge y ve a:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Activa **Developer mode / Modo desarrollador**.
3. Haz clic en **Load unpacked / Cargar descomprimida**.
4. Selecciona la carpeta `extension/` de este repo.
5. Presiona **Recargar** en la tarjeta de la extensión después de cambiar iconos.

## Popup / créditos

Al presionar el botón de la extensión, se abre un popup con referencia al creador **HeyKhana**.

## Cómo probarla manualmente (múltiples imágenes)

1. Abre el archivo `extension/manual-test.html` en el navegador.
2. Selecciona varias imágenes en un input con `multiple`.
3. Debe abrirse **un solo editor** con navegación por imagen (Prev/Next).
4. En cada imagen, dibuja rectángulos con mouse:
   - `mousedown` inicia
   - `mousemove` previsualiza
   - `mouseup` confirma el rectángulo
5. Usa **Undo Last** o tecla `R` para deshacer en la imagen actual.
6. Pulsa **Confirm All** para exportar todas las imágenes editadas y reemplazar el input.

## Checklist rápido de validación

- [ ] Intercepta 1 o múltiples imágenes
- [ ] Popup permite activar/desactivar
- [ ] Editor único con navegación Prev/Next
- [ ] Cada imagen conserva sus propios rectángulos
- [ ] Mosaico por defecto en 15 y configurable
- [ ] Preview del editor coincide con resultado final
- [ ] El input queda reemplazado con todos los archivos censurados

## Créditos

Creado por **HeyKhana**.
