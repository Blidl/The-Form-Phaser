# The Form — Mini Spec: Cutscene Vocabulary

## Назначение

Задать минимальный, но достаточный набор команд для demo cutscenes.

## Типы катсцен

### 1. `in_level`

- живые объекты сцены
- player input locked
- camera moves in current level

### 2. `overlay`

- отдельный слой поверх игры
- может использоваться для межуровневых вставок

## Обязательные команды первой версии

- `lock_input`
- `unlock_input`
- `wait`
- `camera_focus_actor`
- `camera_pan_to`
- `play_animation`
- `move_actor`
- `set_emotion`
- `play_sfx`
- `spawn_vfx`
- `trigger_event`

## Дефолтные правила

- Катсцены первой версии нескипаемые, если пользователь явно не решит иначе позже.
- Gameplay во время `in_level` cutscene полностью lock.
- Команды выполняются последовательно.
- Никакого branching timeline в первой версии.
- Subtitle layer можно добавить позже, но runtime должен не мешать его будущему добавлению.

## Acceptance Criteria

- Cutscene можно запустить из trigger.
- Cutscene можно запустить от NPC interaction.
- Камера, animation и input lock работают предсказуемо.
- Sequence редактируется через JSON без необходимости лезть в код уровня.

## Риски

- Попытка слишком рано сделать универсальный timeline editor.
- Смешение gameplay events и cutscene events без явных контрактов.
- Жёсткие зависимости на конкретные scene objects без стабильных ids.

## Что потом можно уточнить

- subtitle layer;
- overlay cinematic transitions;
- conditional branches;
- replay/recorded scene semantics.
