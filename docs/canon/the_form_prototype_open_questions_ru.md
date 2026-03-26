# The Form — Prototype Open Questions

Статус: working list  
Дата: 2026-03-25

## Назначение документа
Этот документ хранит не «дыры канона вообще», а только те вопросы, которые полезно оставить явными и не растворять в скрытых допущениях.

На момент фиксации базовый канон прототипа уже собран. Ниже — вопросы следующего уровня, которые не мешают считать текущие решения рабочим source of truth, но потребуют отдельного решения перед подробной реализацией или полировкой.

## 1. Трансформация формы
- Как именно выглядит короткая анимация/визуал трансформации между формами?
- Нужен ли у трансформации отдельный VFX/juice-слой уже в раннем прототипе?

## 2. Visual marker
- Какой конкретный визуальный язык у marker в прототипе: точка, светящееся ядро, стрелка, орб, ring-marker?
- Должен ли marker менять цвет/состояние в зависимости от формы уже в первом прототипе или оставаться нейтральным?

## 3. Реализация повёрнутых коллизий в Phaser-native / docs-first / prefab-by-code-first / TypeScript-first подходе
- Какой практический компромисс будет выбран для Triangle real-rotation collision в первом прототипе?
- Какой практический компромисс будет выбран для Square real-rotation в обычном движении и attach/rollover?
- Где проходит граница между «ещё можно prefab-by-code-first / TypeScript-first» и «уже нужен маленький TypeScript helper»?

## 4. Ball tuning
- Какие стартовые диапазоны параметров считаются каноничными для:
  - first jump height;
  - rebound height;
  - wall upward correction;
  - hit pause;
  - boost impulse;
  - hold acceleration decay?

## 5. Triangle tuning
- Какие стартовые диапазоны параметров задаются для:
  - jump spin start;
  - freeze duration / exit behavior;
  - dash speed;
  - dash duration;
  - charge regen delay;
  - stick-in-wall behavior?

## 6. Square tuning
- Какие стартовые диапазоны параметров задаются для:
  - trail max capacity;
  - trail drain per distance;
  - auto regen speed;
  - manual regen delay/speed;
  - attach-jump height;
  - return-to-trail spring behavior;
  - rollover preview / trigger thresholds?

## 7. Wind tuning
- В каких геймдизайнерских единицах будет удобнее задавать силу wind по формам?
- Должна ли сила wind быть общей с весом формы через одну модель, или это независимые параметры на прототипе?

## 8. Debug UI scope
- Что именно входит в минимальный debug UI первой версии?
- Что показывается всегда, а что по toggle?
- Нужно ли в дебаге сразу визуализировать:
  - marker;
  - bounce vectors;
  - triangle orientation;
  - square trail / attach zones / rollover preview?

## 9. Документационная структура следующего шага
Следующий набор canonical docs, который логично собрать:
- `prototype_forms_overview.md`
- `feature_ball.md`
- `feature_triangle.md`
- `feature_square.md`
- `feature_level_objects.md`
- `feature_camera_ui.md`
- `parameters_registry_prototype.md`

