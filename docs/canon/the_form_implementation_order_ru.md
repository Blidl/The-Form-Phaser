# The Form — Prototype Implementation Order

Статус: canonical draft  
Дата: 2026-03-25

## 1. Назначение документа
Этот документ фиксирует **рекомендуемый порядок сборки прототипа `The Form` в `Phaser`**.

Его задача:
- не начинать с самых тяжёлых механик раньше времени;
- сохранить `Phaser-native / docs-first / Codex-first / scene-first / TypeScript-first` подход;
- собирать прототип слоями, где каждый следующий шаг опирается на уже проверенную базу;
- заранее разделить, что делаем сначала ради устойчивого production path, а что оставляем на later slice.

Этот документ описывает именно **implementation order**, а не весь канон механик. Источником истины по механикам остаются:
- `the_form_prototype_decisions_ru.md`;
- релевантные `feature_*` документы;
- `the_form_test_scene_spec_ru.md`.

---

## 2. Главный принцип порядка
Хотя по игровой сложности `Triangle` и `Square` являются самыми рискованными формами, **реальный порядок реализации не должен начинаться с них**.

Для нового прототипа принят такой принцип:

1. сначала собрать **общую scene/config/data/Codex-base основу**;
2. затем собрать **дефолтную Ball-ветку** как самый удобный carrier для проверки базовых систем;
3. затем собрать **общую инфраструктуру form switching / UI / marker / scene objects**;
4. только потом переходить к `Triangle`;
5. и после этого — к `Square`.

Причина:
- `Triangle` и особенно `Square` завязаны на уже готовые общие системы;
- если начинать с них, проект почти сразу уйдёт в сложную геометрию без проверенной базы;
- `Ball` даёт самый дешёвый способ проверить: input, jump, death, checkpoint, platforms, camera, wind, transform flow.

---

## 3. Implementation strategy summary

### 3.1. Приоритет order
Рекомендуемый порядок сборки:

1. **Project shell + test scene foundation**
2. **Common player shell**
3. **Common input + timers + marker**
4. **Ball base**
5. **Camera**
6. **Checkpoint / hazard / moving platform / trigger platform / wind**
7. **Form switching shell + minimal UI**
8. **Triangle**
9. **Breakable objects**
10. **Square attach baseline**
11. **Square trail resource + regen**
12. **Square attach-jump with return**
13. **Square rollover + rollback**
14. **Pass of cleanup / parameter surfacing / debug pass**

### 3.2. Что нельзя делать раньше времени
Не рекомендуется до готовности базовых слоёв:
- сразу строить `Square rollover`;
- сразу делать полный `Triangle freeze + dash + stuck-in-wall`;
- сразу пытаться идеально тюнить wind, camera и form switching;
- раньше времени строить красивые VFX/UI вместо gameplay proof.

---

## 4. Фаза 0 — Project shell
### Цель
Создать чистую основу проекта и test scene, не влезая сразу в сложную механику.

### Что делаем
- создаём новый проект `Phaser` под прототип;
- заводим базовые папки ресурсов;
- создаём каноническую `test scene`;
- создаём placeholder-спрайты/формы, если финальных ещё нет;
- задаём scene/view setup на минимальном уровне.

### Что делаем через scene/config/data wiring
- folders/resources;
- scene layers;
- placement базовой геометрии;
- baseline instances;
- initial camera/view settings.

### Exit criteria
- проект открывается без legacy-хвостов;
- есть одна каноническая `test scene`;
- в scene уже есть заготовки для базовых проверок.

---

## 5. Фаза 1 — Common player shell
### Цель
Создать один `pf_player` как общий носитель трёх форм.

### Что делаем
- создаём `pf_player`;
- вводим текущую форму как state/mode;
- создаём базовые переменные общих систем;
- делаем spawn в `Ball` как дефолтную форму;
- подключаем placeholder визуал и базовый draw.

### На этом этапе пока НЕ делаем
- сложный Triangle behavior;
- Square attach;
- rollover;
- сложный UI.

### Exit criteria
- в scene стабильно существует один игрок;
- он спавнится как `Ball`;
- общие переменные и timers инициализируются предсказуемо.

---

## 6. Фаза 2 — Common input, timers, marker
### Цель
Собрать общую платформу ввода и общие системные таймеры раньше механик форм.

### Что делаем
- `WASD`;
- `Space`;
- `K`;
- `O`;
- `Q/E`;
- общие timers:
  - coyote time;
  - jump input buffer;
  - transformation lock;
  - death pause;
- visual marker как always-visible элемент.

### Порядок внутри фазы
1. input map;
2. buffer/forgiveness timers;
3. marker movement with inertia;
4. marker return to center;
5. debug-visible marker verification.

### Предпочтительный подход
- сначала `scene/config wiring`, если логика остаётся читаемой;
- marker inertia — кандидат на узкий `TypeScript`, если в `scene/config wiring` станет хрупко.

### Exit criteria
- input стабильно читается;
- marker ведёт себя одинаково для всех форм;
- общие таймеры работают независимо от конкретной формы.

---

## 7. Фаза 3 — Ball base
### Цель
На Ball проверить базовую платформенную читаемость и общий movement-feel.

### Что делаем сначала
- ground movement;
- обычный jump;
- coyote time;
- jump buffer;
- dynamic jump height;
- air control.

### Что делаем потом
- boost по `K` на земле;
- фиксируем boosted jump Ball: рост в первую очередь по горизонтальной скорости вылета, при почти фиксированной высоте (чуть выше обычной);
- фиксируем high-speed low-control режим Ball в воздухе при удержании `K` (сильно ограниченный air control);
- сначала делаем `Ball wall rebound` как отдельный контракт, не меняя `Ball floor rebound`;
- фиксируем `Ball wall rebound` без требований стартовой скорости в сторону стены и без требования удерживать направление в сторону стены;
- фиксируем `Ball wall rebound` по условиям: `Ball` в воздухе + контакт со стеной или короткое `wall-coyote` окно + нажат `jump`;
- фиксируем направление `Ball wall rebound`:
  - reflection от нормали стены при явной входящей скорости в стену;
  - fallback «нормаль + слабая поправка вверх» при слабой/нулевой входящей скорости;
- фиксируем `Ball ceiling rebound` как reflection по нормали потолка;
- фиксируем minimum exit strength wall/ceiling rebound не ниже baseline обычного jump;
- проверяем отсутствие искусственных ограничений/cooldown и post-start damping между последовательными wall/ceiling rebound;
- фиксируем приоритет `coyote jump` над wall rebound;
- фиксируем, что wall rebound валиден только от платформенных поверхностей;
- отдельно подтверждаем, что `Ball floor rebound` и распрыгивание на полу остаются как есть.

### Почему Ball раньше Triangle/Square
Потому что Ball:
- дефолтная форма респавна;
- даёт дешёвую проверку общего platformer-feel;
- позволяет проверить camera / death / checkpoint / wind раньше сложных угловых механик.

### Exit criteria
- Ball уже ощущается как играбельная форма;
- можно двигаться, прыгать, падать, умирать и возвращаться на checkpoint;
- `Ball wall rebound` реализован как отдельный контракт и не ломает базовую геометрию scene;
- `Ball ceiling rebound` работает по reflection-контракту и minimum exit strength;
- `Ball floor rebound` и распрыгивание на полу не изменены.

---

## 8. Фаза 4 — Camera
### Цель
Поставить камеру рано, но только после того, как есть хоть какой-то настоящий movement.

### Что делаем
- follow camera;
- freedom frame / deadzone;
- lower-center bias;
- минимальную плавность.

### Не делаем пока
- сложные camera states;
- кинематографические переходы;
- крупный camera polish.

### Exit criteria
- Ball играется в scene с читаемой камерой;
- игрок может смещаться внутри frame без постоянного дёрганья камеры.

---

## 9. Фаза 5 — World interaction baseline
### Цель
Собрать объекты мира, которые нужны почти всем формам.

### Что делаем
- checkpoint;
- hazard;
- moving platform;
- trigger platform;
- wind zone.

### Почему здесь, а не позже
Потому что эти объекты понадобятся всем трём формам и должны быть проверены на Ball до сложных форм.

### Exit criteria
- death/reset cycle работает;
- платформы двигаются и возят игрока;
- wind влияет на Ball;
- scene уже похожа на системный testbed.

---

## 10. Фаза 6 — Form switching shell + minimal UI
### Цель
Собрать форму как системный контракт до внедрения Triangle/Square.

### Что делаем
- `Q/E` cycle;
- transformation state;
- repeated-switch lock;
- проверку валидного пространства для новой формы;
- отмену switch при невалидном пространстве;
- minimal form UI справа внизу;
- верхний UI shell.

### Важно
На этом этапе можно ещё не иметь всей финальной логики `Triangle/Square`, но contract switching уже должен существовать.

### Exit criteria
- можно переключаться между формами без развала player core;
- трансформация блокирует повторный switch;
- неверный switch корректно отменяется.

---

## 11. Фаза 7 — Triangle baseline
### Цель
Собрать самую рискованную форму после того, как общий каркас уже стабилен.

### Порядок внутри фазы
1. real orientation baseline;
2. special jump through rotation;
3. grounded support on any face;
4. airborne control of leading corner;
5. freeze;
6. dash;
7. dash charges;
8. recharge on `O` while grounded;
9. dash without freeze from valid states;
10. stuck-in-solid behavior;
11. jump-away by surface normal.

### Почему Triangle раньше Square
Потому что `Triangle` проверяет:
- real orientation;
- shaped collision;
- special jump logic;
- dash state;
- state transitions under transform;
без world-trail persistence, которая делает Square ещё дороже.

### Где возможен узкий TypeScript раньше всего
- orientation / leading corner logic;
- shaped collision handling;
- dash vector selection.

### Exit criteria
- Triangle играется как отдельная форма;
- charges / freeze / dash работают;
- после жестких ситуаций треугольник приходит на грань, а не зависает случайно.

---

## 12. Фаза 8 — Breakable baseline
### Цель
Добавить breakable-объекты сразу после Triangle, а не до него.

### Что делаем
- объекты, которые ломаются только от `Triangle dash`;
- простое исчезновение;
- простую анимацию/эффект;
- превращение участка в проходимый.

### Exit criteria
- Triangle корректно взаимодействует с breakable;
- другие формы не получают accidental special behavior.

---

## 13. Фаза 9 — Square attach baseline
### Цель
Собрать Square не с rollover, а с attach-основы.

### Что делаем сначала
- квадратная форма с реальным поворотом;
- attach к валидной поверхности;
- пол / стены / потолок / наклоны;
- attach-compatible moving objects;
- detach при выходе из состояния.

### Не делаем пока
- полный trail economy;
- tether return;
- rollover.

### Exit criteria
- Square умеет стабильно attachиться к world surfaces;
- переходы floor / wall / ceiling уже не разваливают базовую логику.

---

## 14. Фаза 10 — Square trail resource + regen
### Цель
Добавить мировое состояние trail после того, как attach уже сам по себе работает.

### Что делаем
- trail generation while attached;
- расход по дистанции;
- global trail state;
- attach to existing trail;
- auto regen outside attach;
- manual regen on `O`;
- erase from oldest to newest;
- stop regen when new attach starts;
- UI progress bar.

### Exit criteria
- trail читаемо живёт в мире;
- regeneration не конфликтует с новым attach;
- UI отражает ресурс без двусмысленности.

---

## 15. Фаза 11 — Square attach-jump with return
### Цель
Добавить привязанный прыжок только после стабилизации attach и trail.

### Что делаем
- jump while holding attach;
- fixed reduced perpendicular jump;
- tether-like visual link;
- return to current valid attach location, not stale world coordinates;
- detach if attach released;
- support for moving compatible surfaces.

### Почему не раньше
Потому что attach-jump зависит сразу от:
- attach baseline;
- trail state;
- moving surface support;
- return target validity.

### Exit criteria
- Square может прыгнуть от trail и вернуться обратно без входа в объект;
- moving object case не ломает return.

---

## 16. Фаза 12 — Square rollover + rollback
### Цель
Добавить самую дорогую механику уже на почти готовую поверхность Square.

### Что делаем
- rollover через внешний угол;
- preview / start conditions;
- переход attach на новую поверхность;
- rollback по той же траектории, если новая attach-поза невалидна.

### Почему это почти последняя core-фаза
Потому что rollover зависит от:
- real square rotation;
- surface attach correctness;
- corner geometry;
- target validity checks;
- rollback logic.

### Где узкий TypeScript почти наверняка оправдан
- corner state evaluation;
- rollover trajectory;
- rollback validation.

### Exit criteria
- внешний угол проходится предсказуемо;
- невалидный исход возвращает квадрат обратно без дрейфа.

---

## 17. Фаза 13 — Integration pass
### Цель
Проверить, что формы и мир взаимодействуют друг с другом по канону, а не только по отдельности.

### Что проверяем
- смерть/респавн из всех форм;
- сброс ресурсов и следов;
- switching во время активных состояний;
- moving/trigger platform interactions;
- wind interactions;
- UI correctness per form;
- transformation collision validity.

### Exit criteria
- test scene можно использовать как главный proof environment;
- все формы проходят базовый системный smoke test.

---

## 18. Фаза 14 — Parameter surfacing and debug pass
### Цель
После того как механика уже работает, вынести всё нужное в настраиваемые параметры и собрать удобный debug слой.

### Что делаем
- выносим силы/времена/дистанции в design-facing параметры;
- сверяем названия с `parameters_registry`;
- добавляем debug UI только в том объёме, который помогает тюнингу;
- не строим giant debug framework.

### Exit criteria
- ключевые параметры доступны для настройки;
- прототип можно тюнить без переписывания core behavior.

---

## 19. Practical sequencing notes
### 19.1. Что можно делать параллельно
Допустимо параллелить:
- scene geometry polishing;
- placeholder art;
- UI mock setup;
- parameter naming.

Но не стоит параллелить несколько тяжёлых core-механик одновременно.

### 19.2. Что замораживать по ходу
После завершения фазы желательно считать её baseline до конца следующей тяжёлой фазы.

Например:
- сначала стабилизировали Ball;
- потом не возвращаемся его радикально ломать, пока не прошли базовый Triangle slice.

### 19.3. Когда возвращаться к rework
Возврат к предыдущему слою оправдан только если:
- новая форма вскрыла реальный дефект общего контракта;
- документированный канон требует пересмотра;
- без rework следующий шаг бессмысленен.

---

## 20. Итоговый recommended build order
В кратком виде:

1. Project shell + test scene
2. `pf_player` shell
3. common input/timers/marker
4. Ball base
5. camera
6. checkpoint/hazard/platforms/wind
7. form switching + minimal UI
8. Triangle
9. breakable
10. Square attach
11. Square trail/regeneration
12. Square attach-jump
13. Square rollover/rollback
14. integration pass
15. parameter/debug pass

Это и есть рекомендуемый порядок, который лучше всего соответствует:
- `Phaser-native` подходу;
- `prefab-by-code-first / TypeScript-first` реализации;
- одному `pf_player`;
- канонической `test scene`;
- снижению риска упереться в самую дорогую механику слишком рано.
