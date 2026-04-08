# The Form — Demo Production Spec (Phaser, RU)

## 1. Назначение документа

Документ фиксирует рабочий tech/design scope для одноразовой demo-версии `The Form` на Phaser.

Это не документ для долгого production на Phaser. После demo проект допускает и ожидает переезд на Unity с перепроектированием toolchain и content pipeline.

## 2. Итог по движку

### Решение

Для demo остаёмся на `Phaser`.

### Почему

- Критическая ценность проекта уже находится в текущей реализации персонажа, форм и runtime-логики.
- В проекте уже есть рабочая связка `Arcade + Matter`, runtime-tuning, встроенный world editor, сериализация конфига мира и test scene.
- Пользователь явно указал, что demo должна делаться быстро, web-first, как одноразовый продающий билд.
- Пользователь также явно указал, что после demo проект в любом случае может быть переделан с нуля на `Unity`.

### Когда Phaser перестаёт быть правильным выбором

Phaser перестаёт быть выгодным не на механиках игрока, а на authoring/tooling scope:

- полноценный content pipeline для многих уровней;
- visual editor уровня Unity-класса;
- sound authoring pipeline;
- катсценный authoring;
- массовые NPC и системная анимация;
- lighting/VFX pipeline для художника, а не только для программиста.

Для demo это допустимо, если инструменты делаются узкими, внутренними и под одного автора.

### Практический вывод

- `Phaser` подходит для demo, если scope жёстко упакован в 4-5 уровней и вертикальный срез.
- `Unity` нужен не до demo, а после demo, когда начнётся нормальный production.

## 3. Текущее состояние проекта по коду

### Уже есть

- единый персонаж `PfPlayer` со сменой форм `ball / triangle / square`;
- runtime-композиция по feature slices, а не giant-controller;
- физика игрока на `Arcade`, а для треугольника и world geometry дополнительно используется `Matter`;
- рабочая test scene `sc_test` как основная игровая сцена;
- встроенный runtime editor мира;
- import/export JSON для мира;
- автосохранение черновика мира в `localStorage`;
- moving platform;
- trigger platform;
- drag box;
- wind zones;
- checkpoint / hazard;
- breakable wall для triangle flight;
- runtime tuning для параметров игрока;
- HUD и debug overlay.

### Уже видно как ограничения

- проект сейчас по сути односценный: `BootScene -> TestScene`;
- меню, прогрессия уровней, финальный flow demo отсутствуют;
- нет систем NPC;
- нет систем катсцен;
- нет sound pipeline;
- нет visual editor для текстур, света, VFX и параллакса;
- нет production-level анимационного пайплайна;
- геометрия мира сейчас в основном прямоугольная и data-driven через конфиг;
- мир не на tilemap, а на наборах runtime-объектов.

## 4. Текущая техническая модель

### Главные единицы

- главная единица измерения: `пиксели`;
- логика движения параметризуется в `px`, `px/sec`, `ms`, `rad/sec`;
- текущая симуляция кадровая, с `deltaMs` из Phaser update;
- authoritative playable scene: `sc_test`.

### Персонаж

- это одна сущность со сменой формы;
- стартовая форма: `ball`;
- при смене формы сохраняются позиция, скорость и runtime state настолько, насколько это допускает текущий runtime;
- общая orchestration-точка: `player_tick_runtime.ts`;
- у triangle есть отдельный collision/runtime слой через Matter;
- marker/point-of-force существует как отдельный визуальный state и движется по input.

### Порядок апдейта кадра

1. editor/tuning UI update;
2. `worldRuntime.updateMovingPlatforms()`;
3. `worldRuntime.syncPlayerCollisionMode()`;
4. `player.tick(...)`;
5. `worldRuntime.postPlayerTickUpdate()`;
6. повторный `syncPlayerCollisionMode()`;
7. hazard overlap / respawn logic;
8. debug/HUD update.

Это важно: многие баги demo надо чинить не локально "в форме", а через жёсткий контракт порядка update/resolve.

## 5. Обязательные инварианты demo

Эти правила должны быть формализованы как source of truth.

### 5.1 Never Embed

Персонаж ни в одном игровом состоянии не должен завершать кадр внутри `solid geometry`.

Допустимо:

- краткое transient-пересечение во время внутреннего расчёта.

Недопустимо:

- завершение кадра внутри пола, стены, потолка;
- перенос объекта или attach, после которых квадрат или другая форма остаётся внутри блока;
- прохождение сквозь solid при конфликте attach + carried object + pit.

### 5.2 Input Wins at Intent Boundaries

Если у квадрата есть несколько валидных вариантов переваливания через угол, приоритет имеет осмысленный ввод игрока, а не случайный порядок overlap/normal resolution.

### 5.3 Trail Must Be Topologically Continuous

След квадрата должен быть непрерывным логически и визуально.

Недопустимо:

- микроразрывы;
- несобранные хвосты;
- визуальное соединение без логического соединения;
- логическое соединение без визуального соединения.

### 5.4 Build Parity

Dev и production build должны читать один и тот же world config и одинаково интерпретировать trigger state.

Особый риск текущего проекта:

- мир грузится из `localStorage` draft, а не только из дефолтного конфига;
- поэтому старый draft может выглядеть как "сломанный билд", хотя проблема не в minify, а в подхваченном состоянии редактора.

Для demo production build должен уметь запускаться без editor draft либо с явным reset draft при старте.

## 6. Решение по demo scope

### Входит в demo обязательно

- 4-5 уровней;
- 10-15 минут геймплея;
- web-first build;
- Steam demo и browser build;
- финальный экран со ссылкой на проект;
- персонаж и три формы как главный selling point;
- feel управления и визуальная подача;
- исправление текущих blocker-багов форм;
- базовый menu flow;
- рабочая последовательность уровней;
- редактор как внутренний authoring tool для сборки demo;
- базовые VFX;
- звук и музыка;
- пассивные NPC;
- враждебные NPC;
- неинтерактивные катсцены;
- декоративные и event-driven props.

### Не входит как обязательный production-quality scope

- универсальный editor уровня Unity;
- полностью general-purpose geometry editor;
- полноценная animation authoring suite;
- сложный branching dialog system;
- сохранение долгого прогресса;
- mobile support;
- автоматические тесты beyond smoke/manual acceptance.

## 7. Реалистичная архитектура demo на Phaser

### Что оставляем как есть

- `scene-first` композицию;
- feature-slice runtime модули;
- единый `PfPlayer`;
- data-driven world config;
- встроенный runtime editor;
- tuning registry для player feel.

### Что надо добавить без смены парадигмы

- `campaign config`: список уровней и их порядок;
- отдельный формат level files вместо одного test-world draft;
- `game flow runtime`: main menu, pause, end-of-demo screen;
- `cutscene runtime`: data-driven sequence player;
- `npc runtime`: ограниченный state-machine layer;
- `audio runtime`: data-driven event + ambience routing;
- `visual presentation runtime`: background/parallax/VFX/light config на уровень;
- `emotion state` у персонажа как общий persisted state между уровнями demo.

### Что не надо строить для demo

- универсальный ECS;
- graph editor;
- node-based cutscene editor;
- отдельный sound editor уровня middleware;
- произвольный polygon authoring suite;
- полноценный material/shader pipeline редакторского класса.

## 8. Спецификация систем demo

### 8.1 Персонаж и формы

#### Ball

- должен терять специальный wall-jump / rebound intent при жёстком столкновении со стеной согласно ожидаемому feel;
- coyote для ball должен стать distance-based, а не только time-based;
- настройки coyote должны быть отдельными для обычного состояния и boost/rebound-состояний;
- wall/ceiling rebound должны быть детерминируемыми и одинаково работать в dev/prod build.

#### Triangle

- breakable wall должна пробиваться гарантированно, если triangle находится в правильном активном состоянии;
- пробитие не должно зависеть от FPS;
- успешное пробитие должно подтверждаться VFX и SFX;
- triangle collision rules нельзя размывать ради "эффекта", потому что это убьёт доверие к форме.

#### Square

- rollover остаётся input-driven;
- при валидном угле и валидном вводе square должен переходить на ту сторону, которую запрашивает игрок;
- attach + carried object не должен ломать collision invariants;
- приоритет в конфликте: сохранить квадрат вне solid geometry, а не "доехать физически красиво";
- trail обязан замыкаться непрерывно на углах и при повторном касании существующего следа.

### 8.2 Marker / Point of Force

- это визуальный маркер ввода;
- живёт в локальном пространстве формы;
- по умолчанию возвращается к центру;
- при активном вводе обязан отражать направление фактического геймплейного intent;
- для demo это не декоративная деталь, а часть читаемости формы.

### 8.3 World / Level

Для demo достаточно data-driven формата уровня с отдельными слоями:

- gameplay;
- visual;
- audio;
- sequence.

Минимальный gameplay набор:

- spawn;
- surfaces;
- hazards;
- checkpoints;
- moving platforms;
- trigger platforms;
- drag boxes;
- wind zones;
- triangle break walls;
- pickups;
- finish trigger;
- NPC anchors;
- cutscene trigger points;
- decorative props;
- background config.

### 8.4 Editor

Editor нужен как внутренний инструмент под одного автора.

Минимум для demo:

- create/select/move/resize/delete;
- duplicate;
- undo/redo;
- JSON import/export;
- save draft;
- palette объектов;
- inspector полей;
- focus camera;
- фиксированная мировая сетка;
- валидация перед export.

Что надо добавить:

- отдельный объект `finish`;
- campaign-level данные;
- platform paths или waypoint mode;
- trigger chains через списки `id`;
- object presets;
- debug trace для trigger logic.

Что можно не делать:

- freeform polygon editor первого класса;
- graph UI;
- version control внутри editor.

### 8.5 Visual Layer

Для demo визуальный editor не должен быть "как ECS engine". Он должен быть pragmatic preset-based.

Правильная модель:

- объект или surface получает `visual profile id`;
- profile описывает текстуру, tint, анимацию, VFX hooks, lighting flags;
- preview сразу виден в runtime editor;
- конфиг хранится data-driven.

Это даст нужный результат дешевле, чем строить свой mini-Unity inspector.

### 8.6 VFX / Light / Parallax

Для demo на Phaser это реализуемо, но с ограничениями.

Нормальный приоритет:

1. impact VFX для форм;
2. break wall VFX;
3. trigger activation VFX;
4. emotion/color feedback;
5. layered parallax backgrounds;
6. ограниченное lighting pass на ключевых уровнях.

Рекомендация:

- не строить full normal-map pipeline на весь проект;
- использовать light/normal only на отдельных hero-объектах и сценах;
- основную атмосферу делать через цвет, градиенты, parallax и маскированные VFX.

### 8.7 Sound

Для demo sound editor также должен быть не отдельным большим редактором, а data panel.

Минимум:

- music per level / menu / cutscene;
- SFX по material/contact/event;
- ambient zones;
- mixer groups: `master / music / sfx / ui / ambient`;
- preview из authoring UI.

### 8.8 NPC

Для demo NPC должны быть ограничены state-driven паттернами.

Пассивные NPC:

- idle/patrol/scripted loop;
- interaction по кнопке рядом;
- запуск prepared sequence;
- реакция на emotion/color state игрока;
- ветвление результата через несколько outcome states, не через диалоговое дерево.

NPC-враги:

- 4-5 типов максимум;
- radius-based sensing;
- patrol/alert/chase/attack/return;
- возможность переключаться trigger-ами;
- по сути это behavioural hazards, а не сложная combat AI.

### 8.9 Cutscenes

Для demo нужен один data-driven cutscene runtime, а не несколько систем.

Поддерживаемые режимы:

- in-level scripted lock sequence;
- overlay/interstitial sequence между уровнями.

Поддерживаемые действия:

- lock player input;
- move/focus camera;
- play animation clip;
- move actor by script;
- trigger VFX/SFX;
- tint/filter overlay;
- subtitle/caption line;
- wait / timeline step.

### 8.10 Анимации

В Phaser анимации надо разделить на 3 класса:

- `transform/state animations`: смена формы, эмоция, hit, break, attach, rebound;
- `timeline animations`: катсцены, NPC scripted sequences;
- `ambient animations`: фон, props, platform details.

Для demo не нужен общий Animator-клон. Нужен data-driven набор clip/state runtime модулей:

- player animation controller;
- npc animation controller;
- cutscene timeline player;
- prop loop controller.

## 9. Формат данных demo

### Уровень

Каждый уровень должен храниться отдельным JSON-файлом.

Минимальная схема:

- `meta`;
- `playerSpawn`;
- `surfaces`;
- `hazards`;
- `checkpoints`;
- `movingPlatforms`;
- `triggerPlatforms`;
- `interactiveObjects`;
- `npcs`;
- `props`;
- `visual`;
- `audio`;
- `cutscenes`;
- `finish`;
- `nextLevelId`.

### Кампания

Отдельный `campaign.json`:

- ordered list уровней;
- display name;
- optional unlock/debug flags;
- end screen target.

### Идентификаторы

- все cross-references только по стабильным `string id`;
- id должны быть human-readable;
- editor обязан валидировать отсутствующие ссылки.

## 10. Главные риски demo

### Высокий риск

- square never-embed bugs в attach/carry/pit сценариях;
- нестабильность triangle break wall;
- build parity триггеров из-за `localStorage` draft;
- объём обязательного scope слишком большой для одного человека без жёсткой приоритизации по качеству реализации.

### Средний риск

- попытка сделать слишком сложный visual/sound editor;
- попытка сделать lighting "по всему проекту";
- слишком общая система NPC;
- слишком сложная катсценная система.

### Правильная реакция на риск

- не расширять общий editor, а добавлять только demo-critical authoring paths;
- не делать универсальные решения там, где достаточно preset/data-driven;
- держать `sc_test` как acceptance scene для механик даже после появления реальных уровней.

## 11. Acceptance criteria demo

### Игрок

- каждая форма проходит свой обязательный набор test cases без blocker-багов;
- персонаж не остаётся внутри solid geometry;
- marker всегда показывает читаемое и ожидаемое направление intent;
- смена формы сохраняет feel и не ломает инерцию сверх задуманного.

### Square

- rollover на внешних углах следует вводу;
- trail не имеет артефактных дыр;
- trail корректно соединяется на углах и повторных касаниях;
- attach/carry/pit не пропихивает square в стену или пол.

### Triangle

- breakable wall ломается стабильно при валидном flight state;
- collision shape triangle совпадает с визуальным ожиданием игрока;
- поведение не плывёт от FPS.

### Ball

- jump/rebound/boost читаются и предсказуемы;
- wall impact сбрасывает запрещённый сохранённый импульс;
- coyote работает по ожидаемой дистанции до поверхности.

### World / Build

- уровень загружается одинаково в dev и prod;
- trigger state не инвертируется между сборками;
- demo build стартует в чистом состоянии без сломанного editor draft;
- каждый уровень имеет finish trigger и корректный переход.

## 12. Практический production-план

### Этап 1. Stabilization

- закрыть blocker-баги игрока;
- ввести `never embed` acceptance;
- починить build parity trigger-ов;
- отделить level files от editor draft.

### Этап 2. Demo Flow

- main menu;
- pause menu;
- finish screen;
- campaign config;
- 4-5 уровней.

### Этап 3. Presentation

- backgrounds/parallax;
- базовый sound runtime;
- базовые VFX;
- emotion/color state.

### Этап 4. Content Systems

- passive NPC;
- enemy NPC;
- cutscene runtime;
- props/events.

### Этап 5. Demo Lock

- playthrough QA;
- perf pass для web build;
- visual clean-up;
- final export pipeline.

## 13. Финальное решение

Для текущей цели правильное решение такое:

- не мигрировать на Unity до demo;
- использовать текущий Phaser-прототип как основу вертикального среза;
- не пытаться превратить demo-инструменты в production-grade editor suite;
- документировать и чинить проект вокруг инвариантов, а не вокруг локальных багов;
- после demo использовать накопленный канон механик и level/data contracts как базу для переезда на Unity.
