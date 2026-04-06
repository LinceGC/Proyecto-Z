# Pre-Upload Mosaic Censor (MV3)

Extensión de Chrome/Edge que intercepta imágenes en `<input type="file">`, abre un editor y aplica mosaico antes del upload.

## Cómo hacerla funcional (instalación)

1. Abre Chrome/Edge y ve a:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Activa **Developer mode / Modo desarrollador**.
3. Haz clic en **Load unpacked / Cargar descomprimida**.
4. Selecciona la carpeta `extension/` de este repo.

## Cómo probarla manualmente

1. Abre el archivo `extension/manual-test.html` en el navegador (doble clic o arrastrar al navegador).
2. Pulsa en el input y selecciona una imagen.
3. Debe abrirse el editor de censura.
4. Dibuja rectángulos con mouse:
   - `mousedown` inicia
   - `mousemove` previsualiza
   - `mouseup` confirma el rectángulo
5. Verifica preview en vivo pixelado.
6. Prueba controles:
   - **Undo Last** o tecla `R`
   - **Cancel**
   - **Confirm**
7. Al confirmar, el archivo del input debe quedar reemplazado por PNG censurado.

## Checklist rápido de validación

- [ ] Solo intercepta cuando hay 1 archivo imagen
- [ ] Rectángulos invertidos (drag en reversa) funcionan
- [ ] Regiones inválidas/tiny se ignoran
- [ ] Se pueden apilar múltiples rectángulos
- [ ] Mosaico por defecto en 15 y configurable
- [ ] El archivo final ya sale censurado antes del upload
