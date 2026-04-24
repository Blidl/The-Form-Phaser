# The Form — Mini Spec: NPC Manpu Emotions

## Назначение

Зафиксировать узкий canon для `Manpu` (manga/anime emotion icons над NPC) как first-pass presentation slice для demo.

## Границы системы

- Manpu — это `NPC presentation overlay`.
- Manpu не является AI behavior state.
- Manpu не является cutscene ownership/state.
- Manpu не является общим VFX framework.

## Канонический вход

- Основной вход: actor-local action `set_emotion`.
- `set_emotion` остаётся shared actor-local action из `actor action layer`.
- Trigger volumes могут выставлять emotion у NPC через узкий trigger command:
  - `targetType: "npc"`
  - `operation: "set_emotion"`
  - `targetId: "<npcActorId>"`
  - `value: "<emotionId>"`

## Canonical Emotion IDs (first pass)

- `sweat_drop`
- `anger`
- `sparkles`

## Сброс и скрытие

- `calm` скрывает Manpu.
- `none` скрывает Manpu.
- `off` скрывает Manpu.
- `null` скрывает Manpu.
- Пустая строка/пустое значение скрывает Manpu.

## Ошибки и неизвестные ID

- Unknown `emotionId` не должен ломать runtime.
- Допустимое поведение first pass:
  - визуально игнорировать unknown `emotionId`;
  - и/или сохранять его только в debug/runtime state (`presentationEmotion`) без визуального overlay.

## First-pass визуальная реализация

- Разрешён Phaser primitive-based рендер внутри существующего NPC visual container:
  - `Graphics`
  - `Shapes` (`Arc`, `Circle`, `Line`, `Triangle`, и т.п.)
- Не добавлять новый universal VFX/editor framework.

## Runtime contract

- Manpu actor-local presentation не блокирует движение/patrol.
- Manpu не отменяет scripted sequence.
- Manpu не смешивает ownership между:
  - NPC behavior runtime
  - cutscene orchestration
  - presentation runtime

## Временный статус реализации

- Если реализация живёт в текущем presentation stub (`npc_visuals` / `npc_runtime` / `npc_actor_action_adapter`), это считается допустимым `TEMPORARY first-pass`.
- Second pass может вынести Manpu в отдельный presentation layer, но без смены канонических входов (`set_emotion`, узкий trigger command).

## Sync с реализацией (2026-04-24)

- Реализован узкий `resolve`-слой (`npc_manpu.ts`) с canonical IDs, hide IDs и safe fallback для unknown значений.
- Поддержаны aliases:
  - `manpu_sweat_drop` -> `sweat_drop`
  - `manpu_anger` -> `anger`
  - `manpu_sparkles` -> `sparkles`
- Для совместимости текущих scripted sequences добавлены safe aliases:
  - `alert` -> `anger`
  - `curious` -> `sparkles`
- Trigger runtime поддерживает command route `npc/set_emotion`; world trigger слой только маршрутизирует команду в узкий NPC runtime API, без переноса presentation ownership.
- Реализация остаётся `TEMPORARY first-pass` в существующем presentation stub (без выделенного полноценного presentation layer).

## Acceptance для implementer

- По `set_emotion("sweat_drop" | "anger" | "sparkles")` над NPC появляется соответствующий icon overlay.
- По `set_emotion("calm" | "none" | null | "")` overlay скрывается.
- Unknown emotion не вызывает exception/crash.
- Scripted sequences и trigger hooks продолжают работать без изменения ownership.

## Editor Authoring (2026-04-24)

Manpu authoring ����������� � 4 surface-�� runtime editor:

1. NPC Inspector:
   - `initialManpuEmotionId` �� instance-������;
   - ��������: `none`, `sweat_drop`, `anger`, `sparkles`;
   - default (undefined) = ��� authored Manpu.
2. Trigger Volume Inspector:
   - `targetType: "npc"` + `operation: "set_emotion"` ����� dropdown UI;
   - `targetId` ���������� �� `config.npcs[].id`;
   - emotion value: `sweat_drop`, `anger`, `sparkles`, `calm`.
3. NPC Scripted Sequence Editor:
   - ��� action `set_emotion` ���� `emotionId` ������������� dropdown-�� canonical ��������;
   - legacy aliases (`alert`, `curious`) �������� ���������� ��� �������� ������ data, �� ����� editor ����� canonical IDs.
4. Cutscene Editor:
   - �������� ������ step:
     - `{ "kind": "set_emotion", "actorId": "<id>", "emotionId": "<id>" }`;
   - step ����������� ��������� ����� actor-local path (`npc runtime -> setPresentationEmotion...`), ��� ���������� cutscene VFX ownership.

������� ownership:
- cutscene orchestration ������ �������� actor-local `set_emotion`;
- presentation Manpu ������� � NPC presentation/runtime ����.
