# The Form — Phaser Project Structure (RU)

## Назначение документа

Этот документ фиксирует **целевую структуру нового проекта The Form** для прототипа, который собирается в подходе:

- `Phaser-native`
- `docs-first`
- `Codex-first`
- `scene-first`
- `TypeScript-first`
- `small-module-first`
- `minimal external tooling only when clearly better`

Документ отвечает на вопросы:

- какие папки и слои должны быть в проекте;
- какие сцены нужны на старте;
- что должно быть отдельным модулем, а что — частью `pf_player`;
- где допустим config/data wiring, а где почти наверняка нужен узкий `TypeScript`;
- как избежать возврата к giant central script / god-object архитектуре.

---

## Главные структурные принципы

### 1. Один `pf_player`, три формы внутри него
Игрок реализуется как **один основной prefab-by-code module**:

- `pf_player`

Внутри него живут:

- общие системы игрока;
- текущая форма;
- form switching;
- input buffer / coyote time / death / checkpoint reset;
- marker;
- общие state-переменные;
- делегирование поведения форме.

Не создаём три отдельных player-пути как основную архитектуру.

---

### 2. Вспомогательные системы — отдельными scene object / factory / module слоями
Отдельными сущностями должны быть:

- checkpoint;
- hazards;
- breakable-объекты;
- moving platform;
- trigger platform;
- wind zone;
- UI;
- scene bootstrap;
- camera controller;
- trail-support объекты, если без них удобнее, чем держать всё внутри `pf_player`.

---

### 3. Не делать giant central controller
Нельзя сваливать всю игру в:

- один гигантский `update`;
- один гигантский `player` файл;
- один центральный controller, который знает всё о мире, UI, debug и каждой форме сразу.

Даже если часть логики живёт внутри `pf_player`, она должна быть **разделена по понятным runtime-модулям, typed config группам и узким зонам ответственности**.

---

### 4. Папки должны отражать смысл, а не только тип ресурса
Структура должна помогать ориентироваться в проекте:

- `assets`
- `src/scenes`
- `src/game/player`
- `src/game/world`
- `src/game/camera`
- `src/ui`
- `src/debug`
- `src/config`
- `docs`

а не просто “все файлы в одной куче”.

---

### 5. Временные placeholder-ассеты допустимы
На этапе прототипа допустимо использовать:

- простые геометрические спрайты;
- цветовые заглушки;
- технические placeholder-иконки;
- временные json/tilemap layouts.

Но структура должна быть такой, чтобы потом ассеты можно было заменить без переделки логики.

---

## Рекомендуемая верхнеуровневая структура ресурсов

### Repo / folders

```text
the-form/
├─ assets/
│  ├─ sprites/
│  │  ├─ player/
│  │  │  ├─ ball/
│  │  │  ├─ triangle/
│  │  │  ├─ square/
│  │  │  └─ marker/
│  │  ├─ world/
│  │  │  ├─ platforms/
│  │  │  ├─ hazards/
│  │  │  ├─ checkpoint/
│  │  │  ├─ breakable/
│  │  │  └─ wind/
│  │  ├─ ui/
│  │  └─ debug/
│  ├─ audio/
│  ├─ fx/
│  ├─ tilemaps/                 (если используем tile workflow)
│  └─ data/
│     ├─ config/
│     ├─ tuning/
│     └─ levels/
│
├─ src/
│  ├─ main.ts
│  ├─ boot/
│  │  └─ game_config.ts
│  ├─ scenes/
│  │  ├─ BootScene.ts           (`scene.key = 'sc_bootstrap'`)
│  │  └─ TestScene.ts           (`scene.key = 'sc_test'`)
│  ├─ game/
│  │  ├─ core/
│  │  ├─ player/
│  │  ├─ world/
│  │  ├─ camera/
│  │  ├─ forms/
│  │  ├─ interactions/
│  │  └─ math_optional/
│  ├─ ui/
│  ├─ debug/
│  ├─ config/
│  ├─ data/
│  └─ shared/
│
├─ docs/
│  ├─ canon/
│  ├─ prompts/
│  └─ acceptance/
│
├─ package.json
└─ tsconfig.json
```

---

## Сцены

### 1. `sc_bootstrap`
Назначение:

- стартовая техническая сцена;
- preload базовых ассетов и конфигурации;
- запуск `sc_test`;
- very-thin bootstrap слой, а не игровой уровень.

На самом первом прототипе может быть очень простой.

Возможный состав:

- загрузка assets;
- регистрация данных;
- запуск `sc_test`.

Если отдельный boot-flow не нужен, допустимо минимизировать этот слой, но **каноничнее иметь `sc_bootstrap`**.

---

### 2. `sc_test`
Главная каноническая test scene.

Назначение:

- проверка всех форм;
- проверка form switching;
- проверка hazards / checkpoint / wind / platforms / breakables;
- проверка camera;
- проверка Square attach / trail / rollover.

Именно эта сцена является основным полигоном прототипа.

Подробный состав — в `the_form_test_scene_spec_ru.md`.

---

## Prefab-by-code modules: core

### `pf_bootstrap`
Роль:

- стартовая инициализация прототипа;
- загрузка базовых данных;
- переход в `sc_test`;
- тонкий boot слой, не второй game framework.

В идеале:

- маленький boot runner;
- минимум логики;
- без превращения bootstrap в центральный god-object.

---

### `pf_game_controller` (опционально)
Нужен только если станет очевидно, что:

- bootstrap-слою тесно;
- глобальные правила прототипа требуют отдельного контроллера;
- появились системы, которые неестественно держать либо в `pf_bootstrap`, либо в `pf_player`.

На старте **не обязателен**. Не создавать “на всякий случай”.

---

### `pf_camera_controller`
Отдельный слой камеры / rig.

Почему отдельно:

- камера — системный слой;
- её лучше не смешивать с `pf_player`;
- так проще настраивать deadzone / bias / smoothing.

Содержит:

- target reference;
- frame / deadzone;
- follow rules;
- smoothing rules.

Для базовой камеры достаточно:

- `Camera`;
- player target;
- typed tuning fields;
- узкий follow-модуль.

Если логика deadzone начнёт требовать неудобной математики — допустим узкий `TypeScript`.

---

## Prefab-by-code modules: player

### `pf_player`
Главный player module.

#### Внутри него должны жить группы логики
- common input
- common timers
- form switching
- base movement shell
- marker
- death / checkpoint reset
- shared state
- per-form delegation

#### Что не должно происходить
Нельзя, чтобы `pf_player` сразу превратился в один giant file.
Даже при одном основном player-модуле внутренняя логика должна быть разбита на понятные части.

---

### Отдельные player-support слои (по необходимости)
Допустимы:

- `pf_player_marker`
- `pf_player_trail_renderer`
- `pf_player_form_visuals`
- `pf_player_debug_overlay`

На старте предпочтительно сначала попробовать без лишнего дробления, но **дробить допустимо**, если это уменьшает сложность core-файла и делает slice проще для Codex.

---

## Prefab-by-code modules: world

### Базовые world-сущности
Должны иметь отдельные модули/фабрики:

- `pf_solid_block`
- `pf_slope_block`
- `pf_breakable_block`
- `pf_checkpoint`
- `pf_hazard`
- `pf_moving_platform`
- `pf_trigger_platform`
- `pf_wind_zone`

Это не обязательно должны быть отдельные классы на каждый пиксельный блок.
Это означает, что **каждый тип world-behavior должен иметь ясную точку сборки**.

### Что допустимо
Если в Phaser удобнее держать часть уровня как tilemap/object layer, а часть как runtime-created objects — допустимо.
Главное, чтобы поведенческие роли были разделены и читались.

---

## Prefab-by-code modules: UI

### `pf_ui_root`
Отдельный корневой UI-слой.

Должен быть способен держать:

- current form indicator;
- next form indicator;
- charges / segments;
- trail resource presentation;
- death / reset feedback;
- временные placeholder-виджеты.

UI не должен жить внутри core player logic.

---

## Prefab-by-code modules: debug

### `pf_debug_controller`
Отдельный debug-layer объект.

Может содержать:

- toggle flags;
- geometry overlays;
- marker/trail визуализацию;
- debug text;
- acceptance helpers.

Его задача — помогать проверке feature-slices, а не диктовать архитектуру gameplay.

---

## Спрайты

### Player sprites
Нужны группы:

- `ball`
- `triangle`
- `square`
- `marker`

### World sprites
Нужны группы:

- platforms
- slopes
- hazards
- checkpoint
- breakables
- wind
- misc test shapes

### UI sprites
Нужны группы:

- current form icons
- next form icons
- charge segments
- trail resource segments
- placeholder panels

---

## Animation / tweens / timers
Отдельный heavy animation-framework заранее собирать не нужно.

На старте достаточно:

- локальных tweens;
- локальных timers;
- frame/visual feedback;
- узких animation helpers по мере надобности.

Не создавать заранее “универсальную анимационную систему всего проекта”, если она пока не нужна.

---

## TypeScript / minimal runtime modules

### Базовое правило
Код делим по смыслу, а не по случайности.

Предпочтительные группы:

- `src/game/player`
- `src/game/forms`
- `src/game/world`
- `src/game/camera`
- `src/ui`
- `src/debug`
- `src/config`
- `src/shared`

### Чего избегаем
Избегаем:

- giant central files;
- смешения разных ответственностей;
- файлов, которые невозможно безопасно менять коротким prompt для Codex;
- скрытого coupling между unrelated системами.

---

## Рекомендуемая naming-схема

### Scene keys
- `sc_bootstrap`
- `sc_test`

### Reusable modules / factories
- `pf_player`
- `pf_camera_controller`
- `pf_checkpoint`
- `pf_hazard`

### UI
- `ui_*`

### Debug
- `dbg_*` или `pf_debug_*`

### Assets
- `spr_*`
- `sfx_*`
- `vfx_*`
- `tm_*` / `lvl_*` / `cfg_*`

Главное — единообразие и читаемость.

---

## Что должно быть создано в проекте самым первым
На старте должны появиться:

- repo skeleton;
- `assets/` и `src/` структура;
- `BootScene` и `TestScene`;
- shell `pf_player`;
- shell камеры;
- shell UI;
- базовые world сущности;
- placeholder assets;
- docs layer для канона и prompt artifacts.

---

## Что пока не нужно создавать заранее
Не нужно заранее создавать:

- сложную save/load систему;
- универсальный event bus “на все случаи жизни”;
- тяжёлую data-driven framework оболочку;
- редакторские утилиты, которые пока не обслуживают конкретный slice;
- сетевую архитектуру;
- красивый production UI.

---

## Практическое правило по сборке через Codex
Структура проекта должна быть такой, чтобы типовой prompt для Codex мог ссылаться на:

- 2–5 релевантных документов;
- 1–6 файлов проекта;
- один чёткий acceptance outcome.

Если для одной фичи нужно читать 20 файлов и полпроекта, структура уже стала слишком сцепленной.

---

## Итоговый structural contract
Новый Phaser-проект `The Form` должен быть устроен так, чтобы:

- механический канон сохранялся;
- сцены, assets, config и code modules были разделены;
- player-core не превращался в giant-file;
- world/UI/debug не липли к одной сущности;
- любая feature могла реализовываться коротким Codex prompt;
- `sc_test` оставалась главной средой проверки;
- проект был понятен как человеку, так и Codex без лишнего токен-шума.
