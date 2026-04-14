# The Form — Mini Spec: Actor Action Layer

## Назначение

Зафиксировать отдельный shared actor action layer для demo, не превращая interaction в universal AI layer и не передавая cutscene runtime владение всей NPC-логикой.

## Роль слоя

- `actor action layer` — общий runtime-слой команд для акторов уровня;
- слой используется player/NPC там, где нужен один и тот же контракт на локальные действия;
- слой не описывает high-level поведение, сюжетную оркестрацию или authored logic уровня.

## Границы ответственности

### 1. Actor Physics / Contact

- отвечает за тело, коллизии, grounded/contact state, блокировки по направлениям;
- не решает, какое high-level действие актер "хочет" выполнить;
- не становится vocabulary для orchestration.

### 2. Actor Action Layer

- исполняет actor-local actions поверх physics/contact;
- держит узкий shared vocabulary действий, которые принадлежат самому актеру;
- может использоваться и обычным runtime-поведением NPC, и scripted/cutscene path, если команда остается actor-local.

### 3. Presentation

- отвечает за визуальное состояние, animation/VFX hooks, facing, pose/readability;
- не владеет поведением и не решает orchestration-задачи.

### 4. Interaction

- отвечает за nearby/button-driven interaction gating, availability и handoff в outcome;
- не становится universal AI layer;
- не подменяет behavior state machine, action layer или cutscene orchestration.

### 5. Cutscene Orchestration

- отвечает за timeline/sequencing, lock/unlock, camera, waits и scripted coordination нескольких actors;
- не становится owner всей NPC-логики;
- не хранит у себя повседневное поведение NPC.

## Разделение vocabularies

### Actor-local actions

Это команды, которые можно исполнять как локальное действие конкретного актера:

- `move_to`
- `stop`
- `face_direction`
- `play_animation`
- `set_emotion`

Критерий: команда меняет локальное action/presentation state актера и может быть вызвана как из обычного runtime, так и из cutscene orchestration.

### Orchestration-only cutscene commands

Это команды, которые принадлежат только timeline/orchestration-слою:

- `lock_input`
- `unlock_input`
- `camera_focus_actor`
- `camera_pan_to`
- `wait`
- `trigger_event`
- `spawn_vfx`
- `play_sfx`

Критерий: команда координирует сцену целиком, а не выражает локальное действие одного актера.

## First-pass ограничения

- first pass не включает `attach_start`;
- first pass не включает `attach_release`;
- actor action layer не должен расширяться до universal command bus;
- если команда нужна только для одной authored сцены и не выражает reusable actor-local action, она остается orchestration-only.

## Authoring Model

- level `npcInstance` хранит placement, refs и narrow overrides;
- profile хранит archetype behavior defaults, presentation defaults и interaction defaults;
- action layer vocabulary хранится отдельно от placement-level authoring;
- cutscene data ссылается на actor ids и orchestration commands, а не встраивает всю NPC-логику в level instance.

## Acceptance Criteria

- один и тот же actor-local action contract может использоваться NPC runtime и cutscene runtime без дублирования semantics;
- interaction слой остается узким и не разрастается до universal AI coordinator;
- cutscene runtime не нужен для обычного idle/patrol/chase/react loop;
- physics/contact, actions, presentation, interaction и cutscene orchestration читаются как отдельные runtime slices;
- `npcInstance` остается узким placement-объектом, а не контейнером всей логики.
