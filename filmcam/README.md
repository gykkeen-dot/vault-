# FilmCam (этап 1)

Веб-приложение без сборки: камера -> WebGL2 (один проход) -> фото. Отдельно от Expo-приложения в корне репозитория.

## Запуск
Камера работает только по HTTPS (или localhost).

    cd filmcam && python3 -m http.server 8123   # проверка на компьютере: http://localhost:8123

Для iPhone выложи папку на любой HTTPS-хостинг (GitHub Pages, Netlify, Cloudflare Pages), открой в Safari,
«Поделиться» -> «На экран “Домой”». Фото: кнопка затвора -> лист «Поделиться» -> «Сохранить изображение».

## Что есть
- Bleach Bypass + 14 ползунков в одном шейдере (`app.js`, `FRAG`)
- Шум зерна из готовой текстуры 256x256
- Цикл через `requestVideoFrameCallback`, превью 1080/720/540 с автоснижением при пропуске кадров, режим «Эко» (30 fps)
- Wake Lock, пауза при сворачивании, фото в полном разрешении камеры
- `state` в `app.js` = будущий пресет (этап 6)
- Этап 2: фронт/тыл, зум 0.5/1/2/3 (0.5 — ультраширокая камера, если iOS отдаёт её в списке; 2 и 3 — цифровой кроп в шейдере), форматы 9:16 / 4:3 / 1:1, таймер 3/10 с, тап = фокус, долгое нажатие = фиксация AE/AF (где браузер это поддерживает)
- Интерфейс: белый пульт управления; экран закреплён, панель ползунков прокручивается отдельно
- Этап 3: 18 эффектов в одном шейдере (`shader.js`): Filters (Bleach Bypass, Doll House, Jet Black, Teal & Orange, Solarize, Candy) и Digicam (CCD, CCD Flash, Nokia, Motorola, 3GS, Webcam, Polaroid, Disposable, VHS, Surveillance, Thermal, Nightvision). Выбор: кнопка FX -> строка эффектов. Цветокоррекция пока формулами, не 3D LUT.

## Превью для Artifact
`preview.html` собирается из `preview.template.html` и `shader.js`: `python3 tools/build_preview.py`.

## Публикация на телефон (GitHub Pages)
Workflow `.github/workflows/pages.yml` выкладывает папку `filmcam/`. Один раз: Settings -> Pages -> Source: GitHub Actions. Для приватного репозитория Pages требует платный тариф GitHub. Если деплой с ветки отклонён правилами окружения `github-pages`, добавь ветку в Settings -> Environments -> github-pages -> Deployment branches.

## Этап 4 (TouchDesigner-эффекты и маска)
- Панель FX теперь с вкладками: PRESETS (Filters + Digicam), TOUCH (27 эффектов в стиле TouchDesigner), ADJUST (14 ползунков, Eco), MASK.
- TOUCH: Warp (Kaleidoscope, Mirror Quad, Tunnel, Swirl, Bulge, Ripple, Noise Warp, Tile Grid, Wave, Glitch Blocks), Style (RGB Split, Neon Edges, Halftone, Dither, ASCII, Mosaic, Hex Pixels, LED Matrix, Cel Edges, Duotone Flow, Wire Grid, Zoom Blur, Pointillize, Hue Cycle, Bloom), Feedback (Echo Trails, Feedback Tunnel; второй проход с историей кадра, только в приложении, не в превью и не в фото).
- MASK: кисть Size / Opacity / Hardness, режимы Erase / Restore, инструменты Brush / Shape, Invert, Reset. Маска хранится 512x512 в долях кадра и работает вместе с Intensity.
- Код: `shader.js` (шейдеры и списки эффектов), `mask.js` (кисть).

## Этап 4b (компактность, оптимизация, правка пресетов)
- Нижняя панель вдвое ниже: зум (.5/1/2/3) и кнопки-переключатели формата, таймера, камеры в одну строку.
- Вкладки FX: PRESETS, TOUCH, MY, ADJUST, MASK. У каждого эффекта свои ручки (блок TUNE внизу панели): размер ячейки, скорость, количество сегментов и т. д. Список в `PARAMS` (`shader.js`).
- MY: сохранение своего пресета (эффект + ручки + ползунки Adjust) в localStorage браузера, повторное сохранение с тем же именем перезаписывает, × удаляет. Экспорта в файл пока нет.
- Оптимизации: обновление видеотекстуры через texSubImage2D, кеш юниформов и найденного эффекта, перерисовка оверлея маски не чаще раза за кадр.
