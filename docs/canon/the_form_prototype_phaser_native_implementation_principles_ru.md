# The Form — Prototype Phaser-Native Implementation Principles

Статус: canonical draft  
Дата: 2026-03-25

## 1. Назначение документа
Этот документ фиксирует правила реализации нового прототипа `The Form` в `Phaser`.

Он нужен, чтобы:
- не скатиться обратно в giant-script архитектуру;
- сохранять `Phaser-native` подход;
- строить прототип через `Scenes`, `TypeScript`, typed config, data-driven wiring и маленькие узкие runtime-модули;
- не подменять архитектуру ручным хаосом и импровизацией “в одном файле”;
- использовать `Codex` как основного исполнителя кода по коротким feature-slice prompt;
- держать `1 prompt -> 1 feature` как целевую рабочую модель там, где это реально без потери точности поведения.

Этот документ задаёт именно **принципы реализации**, а не описывает механику саму по себе.

---

## 2. Базовый implementation stance
Для прототипа принят такой порядок приоритетов:

1. **Docs-first**
2. **Codex-first**
3. **Scene-first**
4. **TypeScript-first для core gameplay logic**
5. **Small-module-first**
6. **Data/config-first**
7. **Visual tooling only if it is clearly local and not core**

Это означает:

- сначала читаем канон и только релевантные `feature_*` документы;
- затем определяем минимальный slice, который должен быть реализован за текущий проход;
- затем собираем короткий prompt для `Codex`;
- core-feel логику не распыляем по giant controller-файлам;
- если что-то можно держать как ясную scene/config/data настройку — держим так;
- если поведение, геометрия или state machine требуют кода — пишем узкий изолированный `TypeScript`;
- визуальные редакторы, внешние graph-слои и heavy plugin-driven workflow не должны становиться источником истины.

---

## 3. Что считается Phaser-native подходом

### 3.1. Приоритет ресурсов движка и проекта
Решения по возможности должны опираться на:

- `Phaser Scenes`;
- scene lifecycle (`init / preload / create / update`);
- `GameObjects`, `Containers`, `Groups`, `Cameras`, `Tweens`, `Timers`;
- typed config objects;
- маленькие runtime-классы и helper-модули;
- чётко разделённые gameplay / ui / debug / world / data слои;
- asset-loader слой;
- scene-local wiring;
- data assets (`json`, `tilemap properties`, config modules), если они реально упрощают tuning.

### 3.2. Что не считается желательным подходом
Нежелательно:

- выносить почти всю игру в один гигантский `update`;
- делать один гигантский `player.ts`, который знает всё о мире, UI, debug и каждой форме сразу;
- строить архитектуру «как будто это не Phaser, а абстрактный движок без lifecycle и scene model»;
- прятать ключевую механику за большим количеством неочевидных helper-слоёв;
- тащить в проект сложный внешний editor-only workflow ради того, что в Phaser проще и чище описывается кодом и config;
- превращать Codex в “переписчик всего проекта за один запрос”.

---

## 4. Главный объект игрока

### 4.1. Канон
Принято:

- один `pf_player`;
- три формы внутри одного player contract: `Ball`, `Triangle`, `Square`;
- общие системы живут в этом же общем слое;
- форма — это режим/состояние игрока, а не отдельная архитектурная ветка с дублированием всего core.

### 4.2. Что означает `pf_*` в Phaser-версии
В этой документации префикс `pf_*` сохраняется как **логический идентификатор повторно используемой сущности**, но в Phaser это не Unity Prefab-asset.

Под `pf_*` здесь понимается один из вариантов:

- factory-функция;
- класс-обёртка над `Container`/`GameObject`;
- prefab-by-code builder;
- scene recipe с понятным публичным API.

То есть имя остаётся, а техническая реализация переезжает в Phaser-эквивалент.

### 4.3. Что выносится в отдельные объекты
Отдельные сущности допустимы и желательны для:

- checkpoint;
- hazards;
- breakable;
- moving platforms;
- trigger platforms;
- wind zones;
- trail representation, если это удобнее как world-state слой;
- UI helper objects;
- debug helpers.

---

## 5. Правило по scene/config wiring

### 5.1. Где использовать по максимуму
Scene/config/data wiring приоритетно использовать для:

- boot flow;
- scene setup;
- reference linking;
- world composition;
- checkpoint activation;
- trigger-логики;
- простых UI-реакций;
- platform path setup;
- camera target assignment;
- debug visibility toggles;
- placeholder asset wiring;
- tuning параметров.

### 5.2. Где этого, скорее всего, не хватит
Ожидаемо сложными зонами являются:

- real orientation логика `Triangle`;
- `Ball` floor rebound / wall rebound contracts;
- `Square` attach / trail / rollover;
- нестандартная геометрия и rotated contacts;
- точный player state contract;
- form switching внутри активных под-состояний.

Для этих зон канонически допускается узкий `TypeScript`.

### 5.3. Ball rebound: canonical split
- `Ball floor rebound` — отдельный контракт. Текущие правила floor rebound и распрыгивания на полу не меняются и не переопределяются в рамках обновлений wall rebound.
- `Ball wall rebound` — отдельный контракт. Он не требует стартовой скорости в сторону стены и не требует удержания направления в сторону стены.
- Для `Ball wall rebound` достаточно, чтобы `Ball` был в воздухе, имел контакт со стеной или находился в коротком `wall-coyote` окне, и был нажат `jump`.
- Для `Ball wall rebound` направление выхода:
  - при выраженной входящей скорости в стену — reflection относительно нормали стены;
  - при слабой/нулевой входящей скорости — fallback по нормали стены с слабой поправкой вверх.
- `Ball ceiling rebound` рассчитывается по текущей скорости как reflection относительно нормали потолка.
- Для wall/ceiling rebound обязателен minimum exit strength не ниже baseline обычного jump.
- Для `Ball ceiling rebound` не вводится отдельный искусственный down-boost, если reflection + minimum strength уже дают корректный результат.
- После старта wall/ceiling rebound не допускаются искусственные ограничения или cooldown.
- Если одновременно валидны `coyote jump` и wall rebound, приоритет имеет `coyote jump`.
- Rebound от стен для Ball должен валидироваться только на платформенных поверхностях (не trigger/checkpoint/hazard).

### 5.4. Runtime physics plugin contract (Arcade)
Если runtime-path сцены использует Phaser Arcade Physics API
(`this.physics`, `physics.add.existing`, `physics.add.collider`, `world.setBounds`),
то в `src/boot/game_config.ts` **обязательно** должен быть явно включён physics config с `default: 'arcade'`.

Симптом вида “виден только фон / сцена пустая” после gameplay integration
в первую очередь трактуется как возможный `config/plugin/runtime crash`,
а не как доказанный render bug.

---

## 6. Правило по TypeScript

### 6.1. Когда TypeScript обязателен
`TypeScript` обязателен там, где без кода невозможно сохранить:

- точную механику;
- предсказуемую геометрию;
- контролируемую state machine;
- читаемый runtime contract;
- ясные acceptance-критерии.

### 6.2. Какой TypeScript считается правильным
Правильный `TypeScript` здесь — это:

- маленькие файлы;
- узкие зоны ответственности;
- явные входы/выходы;
- минимум скрытой магии;
- без giant switchboard-файлов;
- без “один бог-контроллер управляет всем”.

### 6.3. Что считается плохим TypeScript
Плохим считается:

- гигантский файл на сотни строк без ясных границ;
- смешение gameplay + ui + debug + asset loading + scene bootstrap;
- код, который нельзя изолированно отдать Codex как короткий feature-slice;
- код, который невозможно проверить по acceptance без чтения половины проекта.

---

## 7. Структура player-логики
Даже при одном `pf_player` логика игрока должна быть разделена хотя бы концептуально на:

- player core state;
- current form state;
- input interpretation;
- marker logic;
- movement / collision logic;
- per-form abilities;
- camera-facing data;
- UI-facing data;
- debug-facing data.

Это не означает, что на старте нужно создать десятки файлов “про запас”.
Это означает, что **при добавлении новой ответственности** она не должна бесконтрольно липнуть к уже существующему файлу.

---

## 8. Геометрия и коллизии
Прототип не строится как physics-sim first.
Канон остаётся таким же, как и в исходных документах:

- platformer-feel первичен;
- точный игровой контракт первичен;
- full rigid-body simulation не является целью первого прототипа;
- поведение должно быть контролируемым, а не “как получилось у physics engine”.

В Phaser это означает:

- физика движка используется как инструмент, а не как источник канона;
- если стандартный physics-body даёт нужный результат — допустимо использовать;
- если стандартный body ломает нужный контракт, геометрия реализуется собственным gameplay-слоем поверх или вместо engine-default поведения;
- сложные углы, attach, rollover и orientation-сценарии нельзя “сдать на волю движка”, если это ломает механику.

Для актуального Square-канона это фиксируется отдельно:

- `Arcade Physics` остаётся базовым locomotion/proxy physics слоем;
- attach-query, attach-snap, surface retarget, `external-corner rollover` и rollback реализуются gameplay-слоем поверх Arcade;
- успех rollover не должен жить в отдельной урезанной ветке, а должен коммититься через тот же attach-contract, что и обычный attach.
- attach/trail gating по ресурсу и существующему trail также должны жить в gameplay-layer, а не в случайных raw-collision ветках.

Для world-objects текущего канона:
- тяжёлый `drag box` может использовать `Arcade` как базовый body для мира и `Matter`-proxy как obstacle для Triangle-path, если это нужно для сохранения единого gameplay-контракта;
- world-object collision contract не должен зависеть от режима коллизий текущей формы игрока;
- player-only colliders и world-vs-world colliders должны быть разведены, если иначе объект ломает собственную физику при form switch.

---

## 9. Test scene как основной truth environment
`sc_test` — это основная каноническая среда проверки.

Она нужна не для красоты, а для:

- проверки всех форм;
- form switching;
- hazards / checkpoint / wind / moving platform / trigger platform / drag box / breakables;
- camera behavior;
- square attach / trail / attach-jump / rollover;
- fast regression-проверки после каждого feature-slice.

Любой slice, который не проверяется в `sc_test`, считается незавершённым или хотя бы недопроверенным.

---

## 10. UI и debug
UI и debug не должны быть слиты с player-core.

Допустимо:

- держать UI как отдельный scene-layer;
- держать debug helpers как отдельный слой;
- пробрасывать наружу только нужные данные;
- иметь временный placeholder UI.

Для `Square` debug acceptance это означает, что допустимо и полезно пробрасывать наружу только специальные debug-facing данные:

- corner-zone state `TL / TR / BL / BR`;
- dangling/attached zone info;
- rollover pivot;
- orientation gameplay-proxy.

Недопустимо:

- чтобы player-core напрямую рендерил весь UI мира;
- чтобы debug-only логика диктовала структуру gameplay;
- чтобы feature-slice считался готовым без хотя бы минимального debug/acceptance способа увидеть результат.

---

## 11. Параметризация как часть реализации
Параметры — это часть архитектуры, а не косметика после кода.

Новый tuning-параметр должен:

- иметь понятное имя;
- иметь понятную единицу смысла;
- жить в предсказуемом config-слое;
- не требовать поиска по десятку файлов;
- быть достаточно локальным, чтобы Codex мог менять его без чтения всего проекта.

Для Phaser-версии допустимо хранить параметры:

- в typed config modules;
- в `json` tuning-файлах;
- в scene-local config;
- в data properties tilemap/object слоя, если это действительно уместно.

---

## 12. Правило по visual tooling
В этой версии прототипа visual tooling не является основой реализации.

Допустимо:

- использовать тайлмап-редактор, object layers, asset-pipeline utilities;
- использовать внешние инструменты только как support-слой.

Недопустимо:

- делать core-mechanics зависимыми от тяжёлого визуального graph workflow;
- строить систему так, чтобы без конкретного editor-инструмента её было невозможно понять;
- раздувать scope ради псевдо-редакторного подхода, которого Phaser от природы не требует.

---

## 13. Правило по Codex prompt workflow

### 13.1. Какой slice считается правильным
Правильный slice для Codex — это тот, у которого есть:

- одна узкая цель;
- фиксированный scope;
- список релевантных документов;
- список файлов, которые можно трогать;
- acceptance-критерии;
- запрет на побочные архитектурные переделки.

### 13.2. Что должно попасть в prompt
В prompt для Codex должны попадать только:

- задача текущего slice;
- нужные doc paths;
- канонические ограничения;
- файлы, которые разрешено менять;
- файлы, которые трогать нельзя;
- ожидаемый результат;
- ожидаемый формат ответа.

Не нужно вставлять в prompt весь проект и все документы, если для текущей фичи это не требуется.

### 13.3. Что считается хорошим результатом
Хороший результат для этого проекта — когда:

- feature реализована в одном проходе;
- логика локальна;
- файлы не раздулись;
- новый код не ломает канон;
- acceptance можно проверить сразу в `sc_test`.

---

## 14. Правило по именованию и читаемости
Имена должны быть:

- стабильными;
- короткими, но не загадочными;
- одинаково читаемыми человеком и Codex;
- единообразными по стилю.

Рекомендуемо:

- `snake_case` для asset ids и doc ids;
- понятные scene keys;
- одинаковые префиксы для world/player/ui/debug сущностей;
- file name ≈ ответственность файла.

---

## 15. Итоговый implementation contract
Новый Phaser-прототип `The Form` собирается так:

- механический канон сохраняется;
- `Scenes`, scene lifecycle, asset/data/config и узкие `TypeScript` модули используются максимально;
- `Codex` работает короткими slice-задачами;
- стремимся к модели `1 prompt -> 1 готовая feature`, но не ценой архитектурной грязи;
- giant-file и giant-controller подход запрещён;
- `sc_test` остаётся главной средой проверки;
- любая новая реализация должна быть достаточно локальной, чтобы её можно было безопасно дать Codex без гигантского контекста.
