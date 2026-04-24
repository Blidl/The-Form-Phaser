# The Form — Orchestrator Log

## Назначение
Это журнал результатов внешних чатов и ключевых решений по ходу реализации.

Сюда писать только:
- что реально было сделано;
- какие файлы изменились;
- что проверено вручную;
- какие новые риски или временные допущения появились;
- какой следующий шаг.

Не писать сюда большие рассуждения. Лог должен читаться быстро.

---

## Формат записи

### Entry
- `Date:` YYYY-MM-DD
- `Task:` название задачи из work queue
- `Status:` done / in_progress / blocked
- `Summary:` 2–5 коротких предложений
- `Files:` список изменённых файлов
- `Manual Check:` что реально проверено вручную
- `Architecture Decisions:` только новые или изменённые решения
- `Risks / Open Items:` что осталось спорным
- `Next Recommended Step:` какая задача идёт следующей

---

## Log Entries

### Entry
- `Date:` 2026-04-08
- `Task:` Orchestrator Setup
- `Status:` done
- `Summary:` Создан оркестраторский контур документации: общее состояние, рабочая очередь, журнал и шаблон intake. Это должно удерживать проектный контекст между многими внешними чатами и не давать потерять архитектурные решения.
- `Files:`
  - `docs/canon/the_form_orchestrator_state_ru.md`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
  - `docs/canon/the_form_external_chat_intake_template_ru.md`
  - `docs/canon/the_form_docs_index_ru.md`
- `Manual Check:` Документы добавлены в `docs/canon`, индекс обновлён.
- `Architecture Decisions:` Canon для оркестрации вынесен в отдельный слой документов, не смешанный с feature specs.
- `Risks / Open Items:` Лог пока содержит только стартовую запись; дальше его нужно поддерживать после каждого внешнего чата.
- `Next Recommended Step:` Запускать `Never Embed Contract` как первый внешний чат и потом занести результат сюда.

### Entry
- `Date:` 2026-04-08
- `Task:` Never Embed Contract
- `Status:` in_progress
- `Summary:` Во внешнем чате добавлен post-tick safeguard в `player_runtime.ts`, который после `tickPlayerRuntime(...)` проверяет overlap Arcade-body игрока с `platform surface` и выталкивает его из финального embed-состояния. Решение сознательно локальное: без переписывания attach/carry state machine, editor или world update order. Build проходит, но живой acceptance playtest по `square attach/carry/pit` ещё не подтверждён.
- `Files:`
  - `src/game/player/player_runtime.ts`
- `Manual Check:` `npm run build-nolog` прошёл. Ручной runtime playtest с reproduce-кейсом `square attach/carry/pit` ещё не выполнен.
- `Architecture Decisions:` Never-embed сейчас реализуется как post-tick safeguard в player runtime. Приоритет отдан гарантии `не завершать кадр внутри solid`, а не локальной “красивой” коррекции attach resolve.
- `Risks / Open Items:` Safeguard не покрывает Matter-based triangle pipeline. Возможны edge cases, где square будет слегка вытолкнут наружу. Основной root cause бага всё ещё считается вероятностной комбинацией `moving support + attach/rollover/attach jump + reset after collision step`.
- `Next Recommended Step:` Выполнить ручной acceptance playtest именно на кейсе `square attach/carry/pit`. Если инвариант подтверждён, переходить к `Square Rollover by Input`. Если останутся артефакты — адресно чинить attach/carry transition до следующей задачи.

### Entry
- `Date:` 2026-04-08
- `Task:` Never Embed Contract — Manual Acceptance
- `Status:` blocked
- `Summary:` Ручная проверка и видео из интервала `2–4s` показали, что текущий `post-tick safeguard` не решает фактический баг `square attach/carry/pit`. Квадрат продолжает устойчиво проталкиваться в невалидную world-позу у стыка геометрии. Это подтверждает, что проблема лежит выше уровня простого post-tick depenetration и требует отдельного разрешения конфликта `attach/carry/world collision`.
- `Files:`
  - `src/game/player/player_runtime.ts`
  - `tmp/video_review/contact_sheet_2_4s.png`
  - `tmp/video_review/frame_06_3.25s.png`
  - `tmp/video_review/frame_07_3.50s.png`
  - `tmp/video_review/frame_08_3.75s.png`
- `Manual Check:` Видео разобрано покадрово в окне `2–4s`. На `3.50s` и `3.75s` квадрат уже устойчиво вдавлен в стык геометрии.
- `Architecture Decisions:` Never-embed safeguard остаётся как страховка, но больше не считается достаточным решением кейса `square attach/carry/pit`. Нужен отдельный attach/carry conflict resolver, где world collision имеет приоритет.
- `Risks / Open Items:` Если сразу идти дальше по списку core stability, мы закрепим неверную основу для square mechanics. Следующий fix должен явно решать: рвётся ли attach, стопорится ли carried object или квадрат переводится в безопасную позу.
- `Next Recommended Step:` Запустить новый внешний чат по задаче `Square Attach/Carry Invalid World Pose Resolution`, затем повторить ручной acceptance именно на этом reproduce-кейсе.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Attach/Carry Invalid World Pose Resolution
- `Status:` in_progress
- `Summary:` Во внешнем чате баг переопределён точнее: проблема была не только в финальном embed, а в том, что square attach-поза продолжала считаться валидной из-за inset-проверки вместо проверки полной snapped rect-позы. В ответ на это добавлена полная overlap-валидация attached pose и immediate break attach, если текущая attached-поза уже world-invalid. Это уже ближе к реальному conflict resolution между attach/carry и world collision, но ручной playtest ещё не подтверждён.
- `Files:`
  - `src/game/player/geometry/player_geometry_queries.ts`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/player_square_runtime.ts`
- `Manual Check:` `npm run build-nolog` прошёл. Ручной runtime playtest по reproduce-кейсу из видео ещё не выполнен.
- `Architecture Decisions:` Для square attach safety теперь действует более жёсткое правило: invalid world pose не может быть выбрана как attach candidate, а уже удерживаемый attach должен рваться сразу при world-invalid attached pose. Post-tick never-embed safeguard остаётся как defensive layer, а не как основное решение.
- `Risks / Open Items:` Пока не подтверждено, не сломает ли это обычный wall/floor attach, attach hold и attach jump. Не ясно, достаточно ли одного break attach, или в части кейсов нужно ещё стопорить carried object.
- `Next Recommended Step:` Повторить ровно тот же reproduce-кейс из видео. Если баг ушёл без заметной регрессии обычного attach-flow, можно перевести `Square Attach/Carry Invalid World Pose Resolution` в `done` и вернуть `Never Embed Contract` к `in_progress`/`done` по фактическому результату.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Attach/Carry Invalid World Pose Resolution — Second Manual Acceptance
- `Status:` blocked
- `Summary:` Второе видео показало, что проблема всё ещё не закрыта. Теперь видно более точно: даже после развития конфликта и фактического разрыва связки с коробкой квадрат может остаться в плохой финальной world-позе у пола/стыка. Это указывает, что одного attach invalidation недостаточно: нужен отдельный разбор порядка detach/depenetration и поведения в multi-solid corner.
- `Files:`
  - `tmp/video_review/video2/contact_sheet_2_4_5s.png`
  - `tmp/video_review/video2/frame_09_4.00s.png`
  - `tmp/video_review/video2/frame_10_4.25s.png`
  - `tmp/video_review/video2/frame_11_4.50s.png`
- `Manual Check:` Новое видео разобрано покадрово. На `4.25s` видно, что carried object уже ушёл вверх, а square всё ещё остаётся в неверной финальной позе.
- `Architecture Decisions:` Баг теперь нужно считать двухслойным: 1) attach/carry conflict resolution; 2) корректная depenetration/escape из multi-solid corner после конфликта. Эти слои надо чинить раздельно.
- `Risks / Open Items:` Если следующий fix снова попытается лечить всё одной общей страховкой, мы потеряем время. Нужен узкий task на deterministic escape vector и порядок detach/depenetration.
- `Next Recommended Step:` Подготовить новый внешний чат на задачу `Square Multi-Solid Depenetration and Detach Ordering`, опираясь на оба видео и уже внесённые partial fixes.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Multi-Solid Depenetration and Detach Ordering
- `Status:` in_progress
- `Summary:` Во внешнем чате добавлен ещё один слой square-fix в `player_runtime.ts`: snapshot до тика, память о `lastValidSquarePose`, directed escape из multi-solid corner и жёсткий порядок `detach -> body reset/depenetration -> velocity cleanup`. Это уже адресует именно остаточный кейс из второго видео, где carry-конфликт фактически распался, но square оставался в плохой финальной позе. Ручной reproduce после этого изменения ещё не выполнен.
- `Files:`
  - `src/game/player/player_runtime.ts`
- `Manual Check:` `npm run build-nolog` прошёл. Ручной playtest по второму видео-кейсу ещё не выполнен.
- `Architecture Decisions:` Для square conflict resolution теперь допустим deterministic preferred escape direction вместо чисто минимальной осевой коррекции. Источники приоритета: attach normal из pre-tick snapshot, `lastValidSquarePose`, support/contact normals, затем фиксированный fallback order.
- `Risks / Open Items:` Пока не подтверждено, что directed escape не создаст регрессии на обычном attach-flow и валидных угловых сценариях. Если reproduce всё ещё останется, следующим слоем придётся смотреть не только depenetration, но и сам порядок world/player update вокруг drag box и moving support.
- `Next Recommended Step:` Повторить именно второй видео-кейс. Если баг ушёл, закрыть `Square Multi-Solid Depenetration and Detach Ordering` и затем проверить, можно ли считать `Never Embed Contract` закрытым хотя бы для square Arcade-path. Если баг жив — делать четвёртый разбор уже по update ordering / support ownership.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Attach Face Snap Regression on Moving Supports
- `Status:` todo
- `Summary:` После последних square fix-ов появилась новая регрессия: при attach к движущемуся объекту квадрат смещается к углу support body вместо ожидаемого face-snap. По коду это больше похоже на побочный эффект ужесточённой pose validation, чем на исходный `pit/carry` баг.
- `Files:`
  - `src/game/player/geometry/player_geometry_queries.ts`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/player_square_runtime.ts`
- `Manual Check:` Пользователь вручную подтвердил визуальный симптом на moving object side contact.
- `Architecture Decisions:` Эту регрессию нужно чинить отдельно от `Square Multi-Solid Depenetration and Detach Ordering`, иначе мы будем смешивать два разных класса square bugs.
- `Risks / Open Items:` Главный риск — попытаться ослабить новые safety fixes слишком широко и вернуть исходный corner/pit bug. Следующий fix должен быть узким и возвращать normal face-snap без отката collision safety.
- `Next Recommended Step:` Запустить новый внешний чат по задаче `Square Attach Face Snap Regression on Moving Supports`.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Architecture Reframe
- `Status:` in_progress
- `Summary:` После повторяющихся square regressions принято более чистое архитектурное решение: не лечить attach/carry баги post-tick depenetration и directed escape-логикой, а вернуть authority миру и attach-pose validation. Из `player_runtime.ts` удалён слой `enforceNeverEmbedContract`, память `lastValidSquarePose` и вся логика forced escape после тика. В `resolveSquarePoseClear(...)` сохранена полная проверка snapped rect против foreign solids, но support body больше не считается конфликтом, а corner-allowance hack убран.
- `Files:`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/geometry/player_geometry_queries.ts`
- `Manual Check:` `npm run build-nolog` прошёл. Ручной runtime playtest после архитектурного упрощения ещё не выполнен.
- `Architecture Decisions:` Новый базовый контракт: square не должен насильственно "исправляться" после тика через координатные коррекции. Attach может коммититься только в валидную pose; если pose невалидна, attach должен рваться или не начинаться, а authoritative collision остаётся у мира/physics.
- `Risks / Open Items:` Возможно, это снова откроет часть исходного `pit/carry` кейса, но зато уберёт накопившиеся регрессии от symptom-driven fixes. Следующий шаг — проверить оба класса square кейсов: attach face-snap и original attach/carry/pit.
- `Next Recommended Step:` Ручной playtest по двум сценариям: 1) moving support face attach; 2) исходный attach/carry/pit reproduce. По результату решать, нужна ли ещё одна точечная square fix-итерация.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Architecture Reframe — Clean Collision Follow-up
- `Status:` in_progress
- `Summary:` Пользователь явно отверг ветку с post-tick forced reposition/depenetration как неправильное архитектурное решение. Актуальная square-стратегия теперь формулируется жёстко: мир остаётся authoritative, square не должен "лечиться" пересчётом координат после факта, attach должен либо коммититься только в валидную pose, либо немедленно рваться. Дополнительный regression fix на `corner-strip foreign overlap allowance` тоже убран, потому что он приводил к неоднозначному face/corner поведению.
- `Files:`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/geometry/player_geometry_queries.ts`
  - `src/game/player/player_square_runtime.ts`
- `Manual Check:` `npm run build-nolog` прошёл после упрощения. Новый ручной playtest ещё не занесён.
- `Architecture Decisions:` Directed escape, `lastValidSquarePose`, post-tick never-embed correction и corner-allowance hacks считаются отвергнутой symptom-driven веткой. Канонический путь: `valid attach pose or detach`, без forced body reset как базовой square-механики.
- `Risks / Open Items:` Возможно, attach/carry/pit баг частично вернётся уже без симптоматических подпорок; если это случится, следующий fix должен идти в attach/runtime ordering, а не в новый слой координатных коррекций.
- `Next Recommended Step:` Проверить два сценария после reframe: 1) face-snap на moving platform/drag box; 2) исходный attach/carry/pit reproduce. Только после этого решать, нужна ли ещё одна внешняя square-задача.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Attach Commit Path Collision Hypothesis
- `Status:` in_progress
- `Summary:` Пользователь выдвинул более сильную гипотезу: square может проходить в невалидную world-позу не потому, что неверно валидируется конечная attach-pose, а потому, что во время attach commit или возврата attach-jump временно игнорируется collision и не проверяется сам путь до snapped pose. Это смещает фокус с `pose clear` на `commit path collision gating`.
- `Files:`
  - `src/game/player/player_square_attach.ts`
  - `src/game/player/player_square_attach_jump.ts`
  - `src/game/player/player_square_runtime.ts`
  - `src/game/player/player_runtime.ts`
- `Manual Check:` Гипотеза выдвинута после ручного наблюдения текущего поведения; отдельный кодовый разбор path collision ещё не проведён в новом внешнем чате.
- `Architecture Decisions:` Если гипотеза подтвердится, правильный fix должен быть не в очередном post-factum reposition, а в том, чтобы attach/snap не коммитился через wall/floor/ceiling вообще. Мир остаётся authoritative не только в финальной позе, но и на траектории attach commit.
- `Risks / Open Items:` Возможен сценарий, где path collision и pose validation оба вносят вклад. Нельзя снова смешать их в один большой fix без доказательств. Следующий внешний чат должен целенаправленно проверить `checkCollision.none`, `reset(...)`, snap ordering и sweep/path semantics.
- `Next Recommended Step:` Запустить отдельный внешний чат по задаче `Square Attach Commit Path Collision`, а затем сверить результат с двумя ручными сценариями: normal face-snap и attach/carry/pit reproduce.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Corner Passive Drift Clamp
- `Status:` done
- `Summary:` В ходе нескольких итераций выяснилось, что external-corner bug объяснялся не только active slide input и не только path collision, а ещё и пассивным attached drift: квадрат мог доезжать до самого стыка даже без корректного rollover intent. Попытки лечить это через velocity clamp, projected query и corner-stop guard были нестабильны, потому что они работали поверх уже плавающей attach pose. Рабочим решением стал более жёсткий attach-runtime контракт: любая attached pose должна сохранять минимум `1/4` контакта с текущей attach surface, иначе pose немедленно clamp'ится назад вдоль той же поверхности.
- `Files:`
  - `src/game/player/player_square_runtime.ts`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/player_square_attach.ts`
  - `src/game/player/player_square_rollover.ts`
  - `docs/canon/the_form_feature_square_ru.md`
  - `docs/canon/the_form_orchestrator_state_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` Пользователь вручную подтвердил, что после ввода безусловного `1/4 contact clamp` квадрат перестал пассивно доезжать до угла в проблемном сценарии.
- `Architecture Decisions:` Для подобных square corner-bugs сначала нужно отделять active slide intent от passive attached drift. Если симптом воспроизводится без осмысленного slide input, лечить velocity недостаточно: invariant должен жить на уровне active attached pose. Minimum-contact clamp считается по current attached surface identity и не должен перекидывать square на соседнюю surface в стыке.
- `Risks / Open Items:` Нужно следить, не создаёт ли этот clamp новые edge cases на moving supports или в нетипичных corner transitions. Если появится похожий баг, сначала надо проверять, нарушен ли minimum-contact invariant, а не возвращаться к post-tick correction или случайным overlap-based retarget.
- `Next Recommended Step:` При следующих square corner regressions сначала проверять три вещи: 1) current attached surface identity; 2) minimum-contact invariant; 3) passive drift vs active slide path. Только после этого трогать rollover branch logic.
### Entry
- `Date:` 2026-04-08
- `Task:` Campaign + Level Metadata
- `Status:` done
- `Summary:` Demo-level data вынесены в `campaign.json` и отдельный level json, а `TestScene` теперь стартует по `levelId` через runtime registry. Формат уровня расширен `meta`, `worldBounds`, singleton `finish` и `nextLevelId`, при этом существующие gameplay-массивы сохранены без перестройки editor/runtime pipeline. Runtime/editor/camera больше не опираются на фиксированные `TEST_WORLD_WIDTH/TEST_WORLD_HEIGHT`: bounds берутся из level config, finish живёт отдельным world-slice, draft autosave привязан к `levelId`.
- `Files:`
  - `src/game/world/runtime/data/campaign.json`
  - `src/game/world/runtime/data/levels/test_world_level_01.json`
  - `src/game/world/runtime/test_campaign_registry.ts`
  - `src/game/world/runtime/test_world_config.ts`
  - `src/game/world/runtime/test_world_config_validation.ts`
  - `src/game/world/runtime/test_world_runtime.ts`
  - `src/game/world/runtime/test_world_editor_storage.ts`
  - `src/game/world/runtime/test_world_editor_adapters.ts`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `src/scenes/BootScene.ts`
  - `src/scenes/TestScene.ts`
  - `src/scenes/runtime/test_scene_bootstrap.ts`
  - `src/scenes/runtime/test_scene_runtime.ts`
  - `src/scenes/runtime/test_scene_frame_runtime.ts`
  - `tsconfig.json`
- `Manual Check:` `npm run build-nolog` прошёл. Отдельный multi-level runtime smoke/playtest ещё не выполнен.
- `Architecture Decisions:` Campaign backbone реализован как узкий registry поверх scene-first потока `BootScene -> TestScene`, без main-menu flow и без giant controller. Finish не смешивался с checkpoint/hazard logic: это отдельный singleton trigger-объект и отдельный overlap-slice в world runtime.
- `Risks / Open Items:` В campaign пока только один уровень, поэтому живой переход `finish -> nextLevelId` кодом подготовлен, но ещё не проверен на реальной multi-level связке. General-purpose world-origin system сознательно не строился: origin по-прежнему фиксирован в `(0,0)`, меняются только `width/height`.
- `Next Recommended Step:` Либо наполнить campaign вторым уровнем для прямой проверки перехода, либо переходить к `Main Menu + Pause + End Screen`.

### Entry
- `Date:` 2026-04-09
- `Task:` Runtime Editor Level Authoring
- `Status:` done
- `Summary:` Runtime editor ������� level controls � sidebar: ������� `levelId`, �������������� `displayName`, `worldBounds`, `nextLevelId` � scene-first ������������ ����� �������� ����� restart `TestScene`. ��� `finish` �������� authoring path � create/select/move/resize/delete semantics, ��� ���� ������ singleton `finish` �� �������� silently. Import/export JSON � per-level draft storage ���������� �������� �� `levelId`, � ����� `worldBounds` ����� ������������� camera � physics bounds.
- `Files:`
  - `src/game/world/runtime/data/campaign.json`
  - `src/game/world/runtime/data/levels/test_world_level_02.json`
  - `src/game/world/runtime/test_campaign_registry.ts`
  - `src/game/world/runtime/test_world_config.ts`
  - `src/game/world/runtime/test_world_config_validation.ts`
  - `src/game/world/runtime/test_world_editor_adapters.ts`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `src/game/world/runtime/test_world_editor_sidebar.ts`
  - `src/game/world/runtime/test_world_runtime.ts`
  - `src/scenes/TestScene.ts`
  - `src/scenes/runtime/test_scene_bootstrap.ts`
  - `src/scenes/runtime/test_scene_runtime.ts`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` `npm run build-nolog` ������. ����� browser smoke ��� level switch, bounds resize � delete/create `finish` � ���� ���� �� ����������.
- `Architecture Decisions:` Level switching �������� scene-first: editor �� ������ ��������� campaign controller, � ������ restart `TestScene` � ����� `levelId` � ������ ���������� �������� editor. Nullable `finish` �������� ���� ��� editor authoring � import/export; campaign registry ��-�������� ���������� shipped levels ��� ������ � ������������ `finish`.
- `Risks / Open Items:` ������ level �������� ��� ����������� demo-safe smoke target, � �� ��� ����������� production content. ����� ������ �������� ������� ������� resize bounds � round-trip �������� � `finish: null`.
- `Next Recommended Step:` ��������� ������ editor smoke �� multi-level authoring � ����� ���������� � ��������� demo-flow ������ ��� ��������� ������ template scenes.

### Entry
- `Date:` 2026-04-09
- `Task:` Runtime Editor Usability Contract
- `Status:` done
- `Summary:` ������ input-focus contract ��� runtime editor � tuning/gameplay hotkeys: �������� ����� helper `isDomTextInputFocused()`, ������������� ������� �������� �� Phaser keyboard capture, � editor hotkeys ������ �� ����������� �� ����� ������ � DOM-�����. Palette ���������� � scene placement mode ��� HTML drag-and-drop: ����� ���� �������� pending placement, ���� �� ����� ������ ������, `Esc` � RMB �������� �����, `finish` ������� singleton. ��� readability � editor render path ��������� ����� ����� world bounds, ���������� �� ��������� ������ � grid, ������������ ��������� bounds.
- `Files:`
  - `src/shared/dom_input_focus.ts`
  - `src/game/player/player_input.ts`
  - `src/ui/runtime/test_debug_runtime.ts`
  - `src/ui/runtime/player_tuning_panel_runtime.ts`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `src/game/world/runtime/test_world_editor_sidebar.ts`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` `npm run build-nolog` ������. Browser-level smoke �� �������� ����� � sidebar/tuning � �� placement flow � ���� ���� �� ����������.
- `Architecture Decisions:` ����������� ������� ���� ������ ������������� scene-first editor runtime, ��� giant editor controller � ��� ������ UI toolkit. DOM input focus ������� � ����� helper, � placement mode ������� � existing pointer/update path ��������� ������ HTML DnD.
- `Risks / Open Items:` Sidebar �� ��� ���������� ������� �� state sync, �� ������ ��������� focus/selection ��� �������� DOM-�����; ���� ������ �������� ����� ������ inspector-������, ����� ������������ �������� DOM-������������� ��������� ������. Placement preview ���� intentionally �����: status + scene cursor ghost, ��� full object-shape ghost ��� ���� �����.
- `Next Recommended Step:` ��������� ������ smoke ������ �� editor usability contract � ������ ����� ������������ � ��������� demo �������.

### Entry
- `Date:` 2026-04-09
- `Task:` Runtime Editor Authoring Contract Finalization
- `Status:` done
- `Summary:` Доведён незавершённый Epic 2 editor authoring contract без нового flow manager: placement mode оставлен scene-first и теперь чётко разделён с existing object selection. `Objects palette` используется только для создания новых объектов через pending placement, а `Objects` list выбирает существующий объект и сразу фокусирует камеру на нём. Добавлен узкий `Create Level` flow, а editor runtime теперь корректно уничтожает DOM/input listeners на scene shutdown/destroy, чтобы level switch не наслаивал второй editor instance.
- `Files:`
  - `src/game/world/runtime/test_campaign_registry.ts`
  - `src/game/world/runtime/test_world_config_validation.ts`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `src/game/world/runtime/test_world_editor_sidebar.ts`
  - `src/game/player/PfPlayer.ts`
  - `src/game/player/player_runtime.ts`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` `npm run build-nolog` прошёл. Browser smoke по create-level, level-switch cleanup и multi-form geometry refresh в этом чате не выполнялся.
- `Architecture Decisions:` `finish + nextLevelId` остаётся единственным каноническим level transition path; отдельный transition object не вводился. Shared geometry refresh закрыт не triangle-specific fix'ом, а общим player-side reset world-geometry references после editor mutations, чтобы square/triangle/other forms не расходились по stale support/collision state.
- `Risks / Open Items:` `Create Level` сохраняет campaign additions в editor-side registry/storage и сразу создаёт level draft, но это всё ещё demo-safe authoring flow, а не production content pipeline. Нужен ручной smoke именно на изменении solid layout при разных формах, чтобы подтвердить отсутствие скрытого stale-runtime state после интенсивного редактирования.
- `Next Recommended Step:` Пройти ручной smoke по placement/create-level/open-level/shared-geometry cases и только после этого возвращаться к следующим demo задачам.

### Entry
- `Date:` 2026-04-12
- `Task:` Main Menu + Pause + End Screen
- `Status:` done
- `Summary:` Demo flow ������ ��� ����� scene-first ���� ������ ������������� `TestScene`, ��� giant flow controller � ��� ���������� gameplay runtime. `BootScene` ������ �� ��������� ��������� `MainMenu`, `Start Demo` �������� `campaign.initialLevelId`, � `finish` � `TestScene` ���� ���� � ��������� `levelId`, ���� �� ��������� `EndScreen`. Pause ���������� ��� overlay-scene �� `Esc`: gameplay scene ������ pause/resume/stop'����, ������� ����� runtime �� �����������, � editor draft storage � per-level restart path �������� �����������. ��� dev ������� ������ ���� ������ ����������� ������ ����� `BootScene` data � query `?levelId=...&editorOpen=1`.
- `Files:`
  - `src/boot/game_config.ts`
  - `src/scenes/BootScene.ts`
  - `src/scenes/MainMenuScene.ts`
  - `src/scenes/PauseMenuScene.ts`
  - `src/scenes/EndScreenScene.ts`
  - `src/scenes/demo_flow.ts`
  - `src/scenes/runtime/test_scene_frame_runtime.ts`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` `npm run build-nolog` ������. Browser smoke �� `main menu -> first level`, `finish -> next level/end screen`, `Esc -> pause`, `restart level`, `main menu` � editor/dev path � ���� ���� �� ����������.
- `Architecture Decisions:` Player-facing flow ������� scene-first � ���������� ������������ `levelId` contract: ���� ������ ���������/������������� �����, � ������ ��-�������� ����������� ����� `TestScene` start data. Pause ������ ��������� overlay-scene, ������� ��������� ��������� ������ ��� ������������� `TestScene`, � �� ����� gameplay-controller; editor ���������� ����� ��������� ��� `Esc`, ������� editor placement/menu contract �� ���������������.
- `Risks / Open Items:` ����� ����� browser smoke ������ �� ��������� pause/menu � runtime editor � �� dev boot override ����� query string. Manual acceptance ����� ������ �����������, ��� ��� `Main Menu`/`Restart Level` paused `TestScene` ������ ��������� ������������ � �� ��������� ������ overlay instance.
- `Next Recommended Step:` ������ ������ smoke �� ���� demo-flow ��������� � ������ ����� ����� ��������� � NPC/cutscene/presentation �������.
### Entry
- Date: 2026-04-12
- Task: Dev Helper Overlay + Level Jump + Click-Spawn
- Status: done
- Summary: Added a dev-only TestScene helper with Numpad + overlay toggle, campaign-order prev/next level jump through existing levelId scene flow, and click-spawn teleport that also updates the active respawn point.
- Files:
  - src/game/world/runtime/test_campaign_registry.ts
  - src/ui/runtime/test_dev_helper_runtime.ts
  - src/scenes/runtime/test_scene_bootstrap.ts
  - src/scenes/runtime/test_scene_frame_runtime.ts
  - src/scenes/runtime/test_scene_runtime.ts
  - docs/canon/the_form_orchestrator_work_queue_ru.md
  - docs/canon/the_form_orchestrator_log_ru.md
- Manual Check: npm run build-nolog passed. Browser smoke was not run in this chat.
- Architecture Decisions: Kept the helper as a separate dev-only runtime slice; no new global debug controller and no bypass of existing TestScene level routing.
- Risks / Open Items: Manual smoke is still required for pause/editor/click-spawn interaction on real canvas input.
- Next Recommended Step: Run the dev-helper smoke checklist, then continue with the next demo/content tasks.

### Entry
- Date: 2026-04-14
- Task: Player Contact Shape Adapter v1 - Triangle vs NPC Stability
- Status: done
- Summary: Fixed the long-running `Triangle - NPC` contact instability after several failed symptom-driven iterations. The rejected approaches were scene-event depenetration in actor-contact runtime, remembered safe pose rollback, residual bounce resolve, and other post-factum coordinate correction layers. The accepted solution moved responsibility back to the movement owner: `actor contact runtime` stays detector-only, while `npc runtime` performs predictive horizontal guard / push-before-commit against the player triangle polygon.
- Files:
  - docs/canon/the_form_orchestrator_state_ru.md
  - docs/canon/the_form_mini_spec_npc_archetypes_ru.md
  - docs/canon/the_form_orchestrator_log_ru.md
  - src/game/world/runtime/test_world_actor_contact_shapes.ts
  - src/game/world/runtime/test_world_actor_contact_runtime.ts
  - src/game/player/player_runtime_contracts.ts
  - src/game/player/player_runtime.ts
  - src/game/player/PfPlayer.ts
  - src/game/world/runtime/test_world_runtime.ts
  - src/game/npc/npc_runtime.ts
  - src/game/npc/npc_types.ts
  - src/ui/runtime/test_debug_runtime.ts
- Manual Check: User confirmed in-thread that the final predictive-guard version fixed the visible gameplay issue after multiple reproductions against left-wall and right-wall triangle pressure cases.
- Architecture Decisions: Canon rule for future chats: do not solve `Triangle - NPC/actor bounds` by adding another post-tick/post-event correction layer on top of actor contact detection. If an actor owns movement, that actor runtime must clamp or validate its intended movement against triangle polygon before commit, and triangle push must happen before fallback stop. `actor contact runtime` is allowed to expose shape snapshots and contact state, but not to become a hidden pair-physics resolver.
- Risks / Open Items: The current fix is still a narrow first-pass for `Triangle - Arcade actor bounds`; it is not a general-purpose actor physics engine. If similar bugs appear for other moving actors, reuse the same architectural pattern rather than copying old depenetration hacks.
- Next Recommended Step: If a future actor also needs triangle-aware motion, extract the predictive guard into a dedicated shared runtime helper instead of rebuilding scene-event overlap correction.

### Entry
- Date: 2026-04-14
- Task: Triangle Support on NPC Surfaces
- Status: done
- Summary: Fixed the remaining invalid `Triangle - NPC` interaction where Triangle could touch NPCs laterally but could not stand on them as a stable support surface. Root cause was architectural: triangle world-geometry runtime only trusts Matter platform surfaces for grounded/support logic, while NPCs existed only as Arcade actors. The accepted solution gives each NPC a synced Matter support-body, marked as a platform surface, and updates it in frame order before player tick and again after NPC movement.
- Files:
  - docs/canon/the_form_orchestrator_state_ru.md
  - docs/canon/the_form_mini_spec_npc_archetypes_ru.md
  - docs/canon/the_form_orchestrator_log_ru.md
  - src/game/npc/npc_runtime.ts
  - src/game/world/runtime/test_world_runtime.ts
  - src/scenes/runtime/test_scene_frame_runtime.ts
- Manual Check: User confirmed in-thread that after the sync support-body integration Triangle now interacts correctly with NPCs as support, instead of bouncing/rotating off them when trying to stand on top.
- Architecture Decisions: �Normal interaction with Triangle� for NPCs now has an explicit canon meaning: NPCs must support both actor-contact semantics and triangle world-support semantics. If Triangle should be able to stand on an actor, that actor must expose a triangle-consumable support surface adapter; actor-contact flags alone are not sufficient.
- Risks / Open Items: This remains a narrow adapter pattern for NPCs and other future moving actors; it is not a justification to migrate all actors onto triangle-style kinematic runtime.
- Next Recommended Step: If another actor class should become a valid Triangle support surface, reuse the same synced Matter support-body pattern instead of inventing a new grounded workaround.

### Entry
- Date: 2026-04-14
- Task: Actor Action Layer Foundation v1
- Status: done
- Summary: Added a separate shared `actor action layer` foundation instead of expanding the NPC planner into a universal controller. The first-pass vocabulary is limited to actor-local commands: `wait`, `face`, `walk_to_x`, `play_animation`, `set_emotion`, `trigger_event`, with execution running through a generic sequence runtime plus an NPC-only adapter. `npc_runtime` remains the owner of high-level behavior selection and movement policy, while the new layer owns only action execution and action-status inspection.
- Files:
  - docs/canon/the_form_orchestrator_log_ru.md
  - src/game/actor_actions/actor_action_types.ts
  - src/game/actor_actions/actor_action_runtime.ts
  - src/game/npc/npc_actor_action_adapter.ts
  - src/game/npc/npc_runtime.ts
  - src/game/npc/npc_types.ts
  - src/ui/runtime/test_debug_runtime.ts
- Manual Check: `npm run build-nolog` passed. Browser/runtime smoke for live scripted execution and debug overlay inspection was not run in this chat.
- Architecture Decisions: The action layer is now a separate runtime slice with a per-actor adapter boundary. `planner -> shared actions` is the intended next migration path; cutscene/interaction/orchestration ownership is intentionally not moved into this slice. Sequence runtime keeps terminal statuses visible for debug and supports in-place refresh of compatible running sequences instead of forcing JSON-signature restarts every frame.
- Risks / Open Items: `play_animation` and `set_emotion` are still TEMPORARY presentation-stub bridges on NPC visuals, not a full presentation system. `walk_to_x` is intentionally narrow and ground-only; no pathfinding, follow, jump, or attach semantics were added here.
- Next Recommended Step: Migrate current NPC planner outputs from ad-hoc movement branches to a fuller `planner -> shared actions` path without changing high-level NPC state ownership.

### Entry
- Date: 2026-04-14
- Task: NPC Scripted Sequence Refs + Runtime Integration v1
- Status: done
- Summary: Added a reusable scripted-sequence refs layer for NPCs without introducing a second action runtime. `npc profile` now supports default `scriptedLoopRef`, `npcInstance` supports a narrow override/clear path, and `npc_runtime` can enter a dedicated `scripted_loop` planner state that resolves `sequenceRef -> ActorActionSequence` and drives the existing `ActorActionSequenceRuntime`. Loop restart is handled by re-ensuring the same resolved sequence after terminal completion, while cancellation stays a narrow `ensureSequence(null)` / runtime destroy path. Debug overlay now exposes configured scripted ref, active scripted ref, current step index, and existing sequence/action status fields together.
- Files:
  - src/game/npc/npc_scripted_sequences.ts
  - src/game/npc/data/test_npc_scripted_sequences.json
  - src/game/npc/npc_types.ts
  - src/game/npc/npc_profiles.ts
  - src/game/npc/npc_runtime.ts
  - src/game/world/runtime/test_world_config_validation.ts
  - src/scenes/runtime/test_scene_bootstrap.ts
  - src/ui/runtime/test_debug_runtime.ts
  - docs/canon/the_form_orchestrator_log_ru.md
- Manual Check: Pending `npm run build-nolog` after integration. Browser/runtime smoke for a live NPC with non-null `scriptedLoopRef` was not run in this chat.
- Architecture Decisions: Scripted NPC sequences remain a data/registry layer above the existing actor action execution contract. Planner ownership stays in `npc_runtime`; first pass uses a dedicated opt-in `scripted_loop` state instead of blending authored loops into a giant AI framework or cutscene controller. `scriptedLoopRef` is profile-first with narrow instance override semantics, and instance `null` can explicitly clear a profile default.
- Risks / Open Items: Shipped profiles/levels are not forced onto scripted mode in this slice, so authored content still needs an explicit ref to exercise the new path. `play_animation` and `set_emotion` still route through TEMPORARY NPC presentation stubs, and missing/invalid refs currently fail quietly into an idle scripted-loop mode with debug visibility rather than a dedicated validation error surface.
- Next Recommended Step: Add the first authored NPC content that opts into `scriptedLoopRef`, then run a browser smoke focused on loop start, restart after completion, and cancellation on level reload/editor rebuild.

### Entry
- Date: 2026-04-17
- Task: NPC Sequence Hooks / Trigger Routing v1
- Status: done
- Summary: Added a narrow NPC-owned hook routing layer above existing scripted sequence refs, without introducing a second sequence runtime or moving ownership out of `npc_runtime`. Profiles can now author `on_spawn`, `on_player_near`, `on_player_far`, and `on_trigger_event` routes; instance overrides stay narrow and only swap or clear spawn/near/far `sequenceRef`s. Hook sequences interrupt the current base planner/scripted sequence while running, then naturally fall back to the normal planner or scripted loop after terminal completion. Debug overlay now exposes active hook id, routed sequence ref, source, and reason, and the editor NPC inspector gained only narrow hook-ref fields.
- Files:
  - docs/canon/the_form_orchestrator_log_ru.md
  - src/game/npc/npc_types.ts
  - src/game/npc/npc_profiles.ts
  - src/game/npc/npc_sequence_hooks.ts
  - src/game/npc/npc_runtime.ts
  - src/game/world/runtime/test_world_config_validation.ts
  - src/game/world/runtime/test_world_editor_adapters.ts
  - src/game/world/runtime/test_world_editor_runtime.ts
  - src/ui/runtime/test_debug_runtime.ts
- Manual Check: `npm run build-nolog` passed. Browser/runtime smoke for authored hook cases and repeated retrigger behaviour was not run in this chat.
- Architecture Decisions: Hook routing remains a separate narrow slice above reusable sequence refs and the existing `ActorActionSequenceRuntime`; no new action verbs, graph editor, or interaction/cutscene owner was added. `on_trigger_event` reuses the existing `trigger_event -> scene event` path and stays profile-authored in first pass, avoiding per-instance event-graph authoring.
- Risks / Open Items: No shipped profile currently authors hook routes, so first-pass runtime support exists but is not yet exercised by default level content. `on_player_near`/`on_player_far` still use simple radius crossings only, and event hooks are processed on the next frame through the existing scene-event queue rather than same-tick orchestration.
- Next Recommended Step: Author one real NPC profile with hook routes and run a browser smoke focused on replace/restart policy and return-to-scripted-loop behaviour.

### Entry
- Date: 2026-04-17
- Task: NPC Hook E2E Validation + Near/Far Stabilization v1
- Status: done
- Summary: Added real authored hook cases to shipped demo NPC content instead of leaving hook routing unexercised. `passive_observer` now combines `scriptedLoopRef` with `on_spawn`, `on_player_near`, and `on_player_far`, while `enemy_sentry` uses `on_trigger_event` driven by observer-authored `trigger_event` actions. Near/far routing stayed on the existing hook path and only received a narrow 8px hysteresis band to suppress threshold chatter; no new sensor framework, interaction runtime, or cutscene layer was introduced.
- Files:
  - src/game/npc/data/test_npc_profiles.json
  - src/game/npc/data/test_npc_scripted_sequences.json
  - src/game/npc/npc_types.ts
  - src/game/npc/npc_runtime.ts
  - src/ui/runtime/test_debug_runtime.ts
  - src/scenes/runtime/test_scene_bootstrap.ts
  - docs/canon/the_form_orchestrator_log_ru.md
- Manual Check: `npm run build-nolog` passed. Browser/runtime smoke on `test-world-01` validated spawn hook start, near `keep_running`, far `restart`, trigger-event restart, return to base behavior, and coexistence with `scriptedLoopRef` via the existing debug overlay plus a dev-only runtime inspection bridge.
- Architecture Decisions: Near/far stabilization remains local to `npc_runtime` and is implemented as hysteresis over the existing edge-memory booleans. Runtime smoke uses a dev-only inspection bridge over existing scene/runtime objects instead of adding a new automation-specific feature layer.
- Risks / Open Items: Hook E2E coverage is currently concentrated on the demo observer/sentry pair. If more profiles adopt hooks, smoke should be repeated against authored profile plus instance-override combinations before expanding the authoring surface.
- Next Recommended Step: Reuse the same authored observer/sentry pair as the baseline smoke fixture for future hook changes, rather than adding a second parallel validation setup.

### Entry
- Date: 2026-04-17
- Task: NPC Interaction E2E Validation + Target Arbitration Stabilization v1
- Status: done
- Summary: Added real authored interaction cases to `test-world-01` without introducing a second interaction framework. The observer cluster now covers profile-default `run_sequence_ref`, instance-override `trigger_event`, instance-override `request_cutscene_ref`, and explicit interaction clear through `interactionOverride.outcome = null`. `npc_interaction_runtime` received only a narrow arbitration stabilization: keep the current available target while it remains valid, otherwise prefer the nearest available target and fall back to the nearest unavailable target for debug visibility. Debug overlay now exposes arbitration source/detail together with target, availability, outcome, and last dispatch result.
- Files:
  - src/game/world/runtime/data/levels/test_world_level_01.json
  - src/game/npc/npc_interaction_runtime.ts
  - src/game/npc/npc_types.ts
  - src/ui/runtime/test_debug_runtime.ts
  - docs/canon/the_form_orchestrator_log_ru.md
- Manual Check: `npm run build-nolog` passed. Vite dev server boot was confirmed over HTTP on `127.0.0.1:8080`. Full live browser/canvas smoke for target arbitration, repeated activation, and cutscene-request event observation was not automated in this chat and still requires a manual pass in the running scene.
- Architecture Decisions: Interaction remains a narrow gating/handoff layer above existing NPC ownership. Arbitration stayed local to `npc_interaction_runtime`; no prompt UI, dialogue layer, cutscene runtime, or new action verbs were introduced. Repeated activation semantics continue to rely on `JustDown(I)` in scene frame runtime and `busy` rejection in `npc_runtime`, instead of adding a second cooldown layer.
- Risks / Open Items: `request_cutscene_ref` still stops at emitting the existing request event and has no runtime consumer by design. Browser validation is still needed to confirm that the new observer cluster feels stable under real movement when several nearby NPCs compete for selection.
- Next Recommended Step: Run a short manual browser smoke on `test-world-01` using the existing debug overlay and `window.__THE_FORM_DEBUG__`, then only make further changes if a concrete target-flicker or request-path issue is reproduced live.

### Entry
- Date: 2026-04-18
- Task: Interaction Debug Visibility + Observable Test Feedback v1
- Status: done
- Summary: Expanded existing interaction observability without changing ownership or adding a new runtime layer. Interaction debug now exposes current target id, distance band, availability, unavailable reason, selected outcome, last input attempt, and last dispatch result in a human-readable form. A small transient on-screen toast now appears for each `I` attempt, making success and rejection states visible even when the full debug overlay is not enough. The profile-default interaction smoke content was also switched to a visibly moving `face/wait/walk_to_x` sequence so manual verification no longer depends on presentation stubs.
- Files:
  - src/game/npc/npc_interaction_runtime.ts
  - src/game/npc/npc_types.ts
  - src/ui/runtime/test_debug_runtime.ts
  - src/game/npc/data/test_npc_profiles.json
  - src/game/npc/data/test_npc_scripted_sequences.json
  - docs/canon/the_form_orchestrator_log_ru.md
- Manual Check: `npm run build-nolog` passed. Live browser/canvas smoke was not automated in this chat, so final human verification of the new toast and overlay visibility still needs a manual pass in the running scene.
- Architecture Decisions: Observability was kept inside the existing interaction debug path and `test_debug_runtime`; no prompt UI, cutscene runtime, extra action verbs, or new gameplay-owner layer was introduced. The new `lastInputAttempt` is a debug-facing snapshot over the existing dispatch path, not a second interaction state machine.
- Risks / Open Items: The observable smoke walk sequence uses authored world-space `walk_to_x` values for the current demo fixture, so if the observer validation setup moves significantly in a future level, that smoke ref should be revisited rather than generalized into a new system.
- Next Recommended Step: Run a manual smoke on `test-world-01` and confirm that the toast plus the expanded `NPC interaction` line make `no_target`, `out_of_range`, `busy`, `dispatched_event`, `requested_cutscene`, and `dispatched_sequence` immediately obvious without opening additional tooling.

### Entry
- Date: 2026-04-21
- Task: Animation Profiles - Player Forms First-Pass Hooks (canon patch)
- Status: done
- Summary: Resolved a canon/work-queue conflict: `Animation Profiles` was marked as strictly "start from NPC", while the current product need is a demo-feel first pass for player forms. Kept NPC-first backbone as the long-term presentation direction, and explicitly allowed only a narrow player-form slice with fixed hook vocabulary. The patch does not introduce a universal animation framework, does not add a new editor, and does not move animation ownership into a giant player controller.
- Files:
  - docs/canon/the_form_orchestrator_state_ru.md
  - docs/canon/the_form_orchestrator_work_queue_ru.md
  - docs/canon/the_form_orchestrator_log_ru.md
- Manual Check: Canon/docs patch only. No runtime code changes were made in this chat.
- Architecture Decisions: First-pass player-form presentation hooks are constrained to `jump_start`, `land_impact`, `airborne`, `form_switch`, with optional form-specific `ball_rebound_launch`, `triangle_flight_start`, `square_attach_start`, `square_attach_jump_start`. This is a temporary demo-enabling slice under Epic 6, while NPC-first presentation backbone remains the target for the full rollout.
- Risks / Open Items: Hook emission/consumption wiring in player runtime/view and live-tuning integration are not implemented yet in this patch.
- Next Recommended Step: Implement narrow hook emission/consumption in existing `player_tick_runtime` + `player_view` slices and validate demo feel via runtime tuning, without expanding scope into a generic animation system.

### Entry
- Date: 2026-04-22
- Task: Player Forms Animation Hooks - Verification Pass (build/typecheck + code-level smoke review)
- Status: done
- Summary: Ran available project checks and completed a manual code-level smoke review for player-form scenarios requested for this pass. `npm run build-nolog` and `npm run build` passed. `npx tsc --noEmit` failed on many pre-existing strict-TS errors across `cutscene/npc/world runtime/editor` and not only in player animation scope. Verified hook wiring for `ball jump/land`, `triangle jump/airborne/flight start`, `square jump/attach/trail regen/attach jump`, form switching, respawn/reset, live tuning apply path, and save-to-project path.
- Files:
  - docs/canon/the_form_orchestrator_log_ru.md
- Manual Check: Code-level trace review completed for `src/game/player/player_tick_runtime.ts`, `src/game/player/player_jump_runtime.ts`, `src/game/player/player_square_runtime.ts`, `src/game/player/player_lifecycle_runtime.ts`, `src/game/player/player_runtime.ts`, `src/game/player/view/player_view.ts`, `src/game/player/view/player_form_animation_runtime.ts`, `src/game/player/tuning/player_tuning_runtime.ts`, `src/game/player/tuning/player_tuning_schema.ts`, `src/ui/runtime/player_tuning_panel_runtime.ts`, `src/scenes/runtime/test_scene_bootstrap.ts`. Confirmed visual scaling is applied only on render objects (`PlayerView`) while physics shape updates stay in `applyCurrentFormCollisionBody` (`setCircle/setSize/setOffset`) and are not animation-driven.
- Architecture Decisions: Kept presentation hooks as one-frame runtime signals collected in `PfPlayerRuntime` and consumed by `PlayerView` animation runtime; no physics coupling added. Kept player tuning integration through existing constants snapshot flow (`applyPlayerTuningRawSnapshot`) with normalization fallback for partial snapshots.
- Risks / Open Items: Working tree currently contains large unrelated edits in world editor/cutscene/NPC areas; runtime editor files are already modified in this branch, so this pass only verified that player animation hook wiring does not directly depend on editor internals. Typecheck baseline is red due to pre-existing repo-wide strict-TS issues, so full static-safety signal is limited until those are cleaned.
- Next Recommended Step: Run in-engine manual runtime smoke in browser for the listed scenarios (especially square attach/regen/jump transitions and tuning sidebar interactions) after stabilizing or isolating unrelated editor/cutscene changes.

### Entry
- Date: 2026-04-22
- Task: Player Forms Animation Hooks - Cleanup + Acceptance Hardening (implementation pass)
- Status: done
- Summary: Completed cleanup/hardening on the implemented player-form animation slice without expanding architecture ownership. Removed hidden runtime intensity scaling from form animation profiles and made `ball/triangle/square.animation` values apply 1:1. Removed dead first-pass rotation offset contract (`rotationOffsetMaxRad` in profile/runtime path and `rotationOffsetRad` pose wiring) instead of keeping unused fields. Removed duplicate airborne wiring by keeping a single canonical source (`grounded` passed into animation runtime) and deleting runtime callback plumbing that pushed separate airborne presentation flags.
- Files:
  - src/game/player/view/player_form_animation_profiles.ts
  - src/game/player/view/player_form_animation_runtime.ts
  - src/game/player/view/player_presentation_hooks.ts
  - src/game/player/view/player_view.ts
  - src/game/player/player_runtime_types.ts
  - src/game/player/player_tick_runtime.ts
  - src/game/player/player_runtime.ts
  - src/game/player/player_constants.ts
  - src/game/player/tuning/player_tuning_defaults.ts
  - src/game/player/tuning/player_tuning_persisted.generated.ts
  - docs/canon/the_form_orchestrator_log_ru.md
- Player Animation Files Changed/Created:
  - changed: src/game/player/view/player_form_animation_profiles.ts
  - changed: src/game/player/view/player_form_animation_runtime.ts
  - created+tracked: src/game/player/view/player_presentation_hooks.ts
- Manual Check: `npm run build-nolog` passed; `npm run build` passed. `npx tsc --noEmit` still fails on existing repository baseline errors outside this cleanup scope (cutscene/npc/world/editor), with additional existing strictness errors in square runtime files already present in the branch before this cleanup pass. No physics-body logic was modified for visuals.
- Architecture Decisions: Kept first-pass animation runtime narrow and explicit: no hidden per-form scaling multipliers, no dead future-facing fields, no additional controller layer. Maintained one-frame presentation hook model while removing redundant airborne source.
- Risks / Open Items: Rotation animation offset remains intentionally out-of-scope for first pass after dead-contract removal. Full in-engine feel validation (especially triangle/square default feel after moving softness to default numbers) still requires runtime smoke in browser.
- Next Recommended Step: Run focused in-engine smoke for ball/triangle/square jump-land-air transitions and form-switch transitions, then lock any remaining feel tweaks directly in tuning defaults (not runtime scaling).



### Entry
- Date: 2026-04-22
- Task: Animation Profiles - Player Forms Phase-Linked Hooks Pass
- Status: done
- Summary: Расширен player presentation contract с edge-фазами `jump_intent`, `jump_commit`, `apex_enter`, `fall_enter`, `land_impact`, `form_switch_in` и form-specific hooks для `ball/triangle/square`. Runtime detection добавлена в существующие player runtime slices без изменения physics contract и без задержки обычного jump commit; `jump_intent` работает только как visual anticipation. В `PlayerView` и `player_form_animation_runtime` добавлен phase-pulse consumption c first-pass hardcoded defaults, включая отдельные pulses для `triangle_flight_end` и `square_attach_exit`. Tuning schema сознательно не расширялась: phase defaults оставлены локально в animation runtime/profile слое, чтобы не раздувать scope и не трогать runtime editor на этом шаге.
- Files:
  - docs/canon/the_form_orchestrator_log_ru.md
  - src/game/player/player_runtime.ts
  - src/game/player/player_runtime_types.ts
  - src/game/player/player_tick_runtime.ts
  - src/game/player/player_jump_runtime.ts
  - src/game/player/player_square_runtime.ts
  - src/game/player/player_lifecycle_runtime.ts
  - src/game/player/view/player_presentation_hooks.ts
  - src/game/player/view/player_form_animation_profiles.ts
  - src/game/player/view/player_form_animation_phase_pulse.ts
  - src/game/player/view/player_form_animation_runtime.ts
- Manual Check: `npm run build-nolog` passed; `npm run build` passed. `npx tsc --noEmit` failed on existing repository-wide strict-TS baseline (cutscene/npc/world/editor + existing square strictness), без новых падений в обновлённом player presentation runtime.
- Architecture Decisions: Gameplay phase detection оставлена в existing player runtime slices (`tick/jump/lifecycle/square`), visual apply остаётся в `PlayerView`, phase consumption в existing player presentation runtime/hooks. Новый global animation framework и расширение runtime editor не добавлялись.
- Risks / Open Items: Это first-pass phase presentation; возможны вторичные feel-тюнинги по порогам `apex/fall` и приоритетам одновременных pulses после in-engine ручного smoke.
- Next Recommended Step: Выполнить ручной in-engine smoke на `ball/triangle/square` сценариях (`jump intent->commit`, apex/fall readability, triangle flight end, square attach enter/exit/attach-jump commit) и только затем решать вопрос о second-pass tuning exposure.

### Entry
- Date: 2026-04-23
- Task: Animation Profiles - Player Form Switch Transition Overlay (first pass)
- Status: done
- Summary: Added a narrow `PlayerView`-owned form-switch visual overlay so gameplay form switching stays immediate while presentation gets a short readable transition. Implemented one shared staged transition (`outgoing compress -> mid morph diamond -> incoming settle`) with fixed timing `35+35+40=110ms` and no pair-specific morph framework. Hooking reuses existing `formSwitchIn` presentation signal and keeps fallback start on direct form mismatch, without changing physics body, collision shapes, hitbox logic, or runtime editor contracts.
- Files:
  - src/game/player/view/player_form_switch_transition.ts
  - src/game/player/view/player_view.ts
- Manual Check: `npm run build-nolog` passed; `npm run build` passed. `npx tsc --noEmit` fails on existing repository baseline issues in `cutscene/npc/world/editor` and existing square strictness files; no new typecheck failures were introduced by the form-switch overlay slice. Live browser visual acceptance (ground/air switch feel) was not automated in this chat and still requires manual runtime smoke.
- Architecture Decisions: First pass intentionally stays a local `Graphics` overlay slice in `PlayerView` with hardcoded timings; no tuning-schema expansion, no global animation manager, no new editor authoring surface, and no universal point-based morph engine were added.
- Risks / Open Items: Visual quality/final feel for all six transitions still needs manual in-engine verification, especially support-readability on ground and no lingering malformed silhouette in air under rapid repeated switching.
- Next Recommended Step: Run focused browser smoke on `ball <-> triangle <-> square` (air + ground + rapid switch spam), then only do second-pass refinements if concrete visual issues are reproduced.

### Entry
- Date: 2026-04-23
- Task: Animation Profiles - Form Switch Window Contract (start/commit/end) first pass
- Status: done
- Summary: Reworked player form switching from immediate gameplay swap + overlay to a narrow timed switch window contract. Added `form_switch_start` at transition begin, moved real gameplay form/hitbox commit to `form_switch_commit` at `30ms`, and finish via `form_switch_end` at `90ms`. During the active window `PlayerView` now hides regular player visuals and renders only the transition overlay, so switching reads as a metamorphosis instead of blinking. Repeated switch input is intentionally ignored while transition is active in this first pass to keep state deterministic and avoid overlapping transition timelines.
- Files:
  - src/game/player/player_runtime.ts
  - src/game/player/player_runtime_types.ts
  - src/game/player/player_tick_runtime.ts
  - src/game/player/player_lifecycle_runtime.ts
  - src/game/player/view/player_presentation_hooks.ts
  - src/game/player/view/player_view.ts
  - src/game/player/view/player_form_switch_transition.ts
- Manual Check: `npm run build-nolog` passed; `npm run build` passed. `npx tsc --noEmit` fails on existing repo baseline in `cutscene/npc/world/editor` and existing square strictness files; no new failures from updated form-switch files were observed in the compiler output list. Visual manual smoke in browser was not automated in this chat and still requires in-engine acceptance pass.
- Architecture Decisions: This pass keeps Phaser player architecture unchanged and does not add a universal morph framework or physics-body morphing. Timings are fixed locally for first pass (`total=90ms`, `commitDelay=30ms`, `postCommitReveal=60ms`) and tuning schema/editor contracts were not expanded.
- Risks / Open Items: Final visual quality still requires manual in-engine verification for ground/air switching and fast repeated input cadence.
- Next Recommended Step: Run focused runtime visual smoke for all six form pairs on ground and in air, then tune only overlay shaping/timing if concrete readability issues remain.
### Entry
- Date: 2026-04-23
- Task: Animation Profiles - Pair-Specific Form Switch Transition Proxy (demo first pass)
- Status: done
- Summary: Свернут неудачный generic overlay/morph path для form switch и заменён на узкий pair-specific transition runtime: один `Graphics` proxy, key-pose data по парам, без universal geometry morph framework. Gameplay switch перенесён внутрь transition window (`total=140ms`, `commitDelay=40ms`), при активном окне базовые визуалы форм полностью скрыты и на экране остаётся только proxy. Сначала был реализован и проверен `ball -> triangle`; после этого добавлены first-pass data для `triangle -> square` и `square -> ball` (reverse остаётся через зеркалирование stage data, без расширения архитектуры).
- Files:
  - src/game/player/view/player_form_switch_transition.ts
  - src/game/player/view/player_form_switch_transition_data.ts
  - src/game/player/player_runtime.ts
  - docs/canon/the_form_orchestrator_log_ru.md
- Manual Check: Playwright runtime pass выполнен для `ball -> triangle` с артефактами в `tmp/acceptance_form_switch_ball_triangle_firstpass/` и zoom-кадрами в `tmp/acceptance_form_switch_ball_triangle_zoom/`; по debug snapshots подтверждены delayed commit внутри окна и скрытие base visuals во время активного proxy. Дополнительно выполнен smoke на `triangle -> square` и `square -> ball` через `window.__THE_FORM_DEBUG__` snapshots (без полного покадрового визуального acceptance для этих двух пар в этом чате).
- Architecture Decisions: Для demo закреплён pair-specific путь с pose-параметрами (`widthScale/heightScale/roundness/cornerSharpness/diamondness/wedgeBias/apexBias`) и staged interpolation (`source->compress->bridge->emerge->target`) вместо generic morph/overlay модели.
- Risks / Open Items: Для `triangle -> square` и `square -> ball` пока выполнен только smoke/contract check; возможно потребуется второй визуальный pass в runtime для финального polish пары/реверсов до demo-lock.
- Next Recommended Step: Провести короткий manual visual acceptance в браузере именно для `triangle -> square` и `square -> ball` (ground + air), и только при обнаружении конкретного артефакта добавить точечные правки pose-data без изменения runtime контракта.
### Entry
- Date: 2026-04-23
- Task: Form Switch Transition - square -> ball narrow readability fix
- Status: done
- Summary: В существующей pair-specific архитектуре выполнен узкий fix только для `square -> ball`: добавлены отдельные pair-specific timing данные (150ms, сегменты 35/40/40/35) и усилены stage poses в data слое, чтобы bridge читался как rounded diamond перед near-circle. Также сделан минимальный runtime/view refactor чтения pair-specific timing без изменения архитектуры generic morph path. Остальные пары не трогались по pose данным.
- Files:
  - src/game/player/view/player_form_switch_transition_data.ts
  - src/game/player/view/player_form_switch_transition.ts
  - src/game/player/player_runtime.ts
- Manual Check: Короткий targeted pass по `square -> ball` выполнен через Playwright артефакты `tmp/acceptance_form_switch_square_ball_narrow_fix/` и framewalk `tmp/acceptance_form_switch_square_ball_framewalk/` с проверкой runtime/visual snapshot последовательности.
- Architecture Decisions: Reverse-path для `square -> ball` оставлен неосновным, используется отдельный direct pair data профиль с собственным timing и позами.
- Risks / Open Items: В headless frame pacing первый тик после switch может быть крупным, из-за чего визуальная стадия в автоматических снимках выглядит короче ожидаемого; для финального demo-polish полезно дополнительно проверить руками в обычном интерактивном runtime.
- Next Recommended Step: Сделать короткий ручной интерактивный pass `square -> ball` (ground+air) и при необходимости править только `square -> ball` data, без изменения runtime контракта.

### Entry
- `Date:` 2026-04-24
- `Task:` Animation Profiles — Hazard Death Transition First Pass
- `Status:` done
- `Summary:` Добавлено узкое окно `dying` для смерти игрока от hazard без изменения physics/hitbox contract. Hazard overlap теперь собирает impact point/normal и запускает presentation-only death transition (outline tear/unwrap line, fill split, marker flash), после чего respawn выполняется через `240ms`. Во время `dying` runtime frozen, base player visuals скрыты, а death presentation тикает отдельно до respawn cleanup.
- `Files:`
  - `src/game/world/runtime/player_respawn_runtime.ts`
  - `src/game/world/hazard.ts`
  - `src/game/player/player_runtime_contracts.ts`
  - `src/game/player/PfPlayer.ts`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/view/player_view.ts`
  - `src/game/player/view/player_death_transition.ts`
- `Manual Check:` `npm run build-nolog` и `npm run build` прошли. `npx tsc --noEmit` падает на pre-existing baseline ошибках вне scope задачи. Playwright smoke: `tmp/death_transition_client/`, `tmp/death_transition_smoke/report.json`, `tmp/death_transition_smoke/square_fix_report.json` + кадры эффекта (`ball_t20`, `square_fix_t60`, `triangle_fix_t5`).
- `Architecture Decisions:` Death pipeline реализован как узкий runtime slice: `hazard hit -> start death transition -> freeze runtime -> delayed respawn`. Transition runtime вынесен в отдельный presentation module `player_death_transition.ts`; respawn path сохранён существующий, только сдвинут по времени после death window.
- `Risks / Open Items:` Triangle/square smoke воспроизводился в узких debug-сценариях возле hazard; для second-pass желательно добавить более стабильный scripted acceptance path по всем формам и кадрам.
- `Next Recommended Step:` Подкрутить визуальную амплитуду/читабельность early triangle silhouette и marker flash по референсу без расширения архитектуры.

### Entry
- `Date:` 2026-04-24
- `Task:` Animation Profiles — Switch Regression + Death Transition Debug/Fix Pass
- `Status:` done
- `Summary:` Проведён узкий regression-debug после death pipeline. Подтверждён runtime-факт: switch proxy path стартовал от `formSwitchStart`, но hook не эмитился в commit-path; добавлен явный emit `formSwitchStart(previous->next)` вместе с `formSwitchIn`, плюс fallback старт в `PlayerView`. Death window сохранён; marker flash отдельно усилен (более яркий/дольше читаемый) без изменения physics/hitbox.
- `Files:`
  - `src/game/player/player_runtime_types.ts`
  - `src/game/player/player_lifecycle_runtime.ts`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/view/player_view.ts`
  - `src/game/player/view/player_death_transition.ts`
- `Manual Check:` Build pass: `npm run build-nolog`, `npm run build`; `npx tsc --noEmit` — baseline pre-existing errors. Runtime smoke: RAF-capture form-switch (`tmp/death_transition_smoke/switch_afterkey_raf_report.json`, `switch_afterkey_raf_00..05.png`) показывает скрытие base visuals и видимый proxy-силуэт в начале окна; death still delayed + marker flash visibly present (`death_ball_flash_t12.png`, `death_square_flash_t20.png`).
- `Architecture Decisions:` Regression fix сделан узко в существующем presentation hook contract; editor/schema/physics paths не тронуты.
- `Risks / Open Items:` Death визуал стал лучше, но всё ещё не 1:1 с референсом (особенно сложные outline/fill нюансы).
- `Next Recommended Step:` Second-pass визуальный тюнинг death sequence без расширения runtime architecture.

### Entry
- `Date:` 2026-04-24
- `Task:` NPC Manpu emotions from triggers (canon patch)
- `Status:` done
- `Summary:` Добавлен новый mini spec `NPC Manpu Emotions` как узкое расширение NPC presentation слоя. Зафиксировано, что Manpu не является AI/cutscene state и не требует нового universal VFX framework. Canonical вход оставлен через actor-local `set_emotion`, а для trigger volumes разрешена узкая команда `targetType: "npc"`, `operation: "set_emotion"` с canonical IDs `sweat_drop/anger/sparkles`. Дополнительно закреплены правила скрытия (`calm/none/null/empty`) и safe-поведение для unknown emotionId.
- `Files:`
  - `docs/canon/the_form_mini_spec_npc_manpu_emotions_ru.md`
  - `docs/canon/the_form_orchestrator_state_ru.md`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` Проверены действующие NPC runtime контракты (`set_emotion` в actor action adapter, `presentationEmotion` в debug/runtime state) и trigger runtime контракт в `test_world_trigger_runtime.ts`/`test_world_config.ts` для совместимого узкого расширения.
- `Architecture Decisions:` Manpu закреплён как actor-local NPC presentation overlay first pass, временно допустимый в существующем presentation stub до отдельного presentation layer.
- `Risks / Open Items:` `the_form_orchestrator_state_ru.md`, `the_form_orchestrator_work_queue_ru.md` и часть canon-файлов уже содержат mojibake/encoding-искажения в текущем репозитории; правки внесены только точечно, без полного rewrite.
- `Next Recommended Step:` Реализовать runtime slice `NPC Manpu emotions from triggers` в `npc_visuals`/`npc_runtime` и расширить trigger command union в `test_world_config` + `test_world_trigger_runtime` без изменения ownership слоёв.

### Entry
- `Date:` 2026-04-24
- `Task:` NPC Manpu emotions from triggers
- `Status:` done
- `Summary:` Реализован first-pass `NPC Manpu emotions from triggers` без расширения архитектуры: Manpu рендерится как actor-local NPC presentation overlay, а trigger volumes выставляют emotion через узкую команду `targetType: "npc"`, `operation: "set_emotion"`. Поддержаны IDs `sweat_drop`, `anger`, `sparkles`; `calm` скрывает overlay. Existing scripted `set_emotion` path сохранён и совместим с Manpu отображением.
- `Files:`
  - `src/game/npc/npc_manpu.ts`
  - `src/game/npc/npc_visuals.ts`
  - `src/game/npc/npc_runtime.ts`
  - `src/game/world/runtime/test_world_config.ts`
  - `src/game/world/runtime/test_world_config_validation.ts`
  - `src/game/world/runtime/test_world_trigger_runtime.ts`
  - `src/game/world/runtime/test_world_runtime.ts`
  - `src/game/world/runtime/test_world_editor_adapters.ts`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `src/game/world/runtime/data/levels/test_world_level_01.json`
- `Manual Check:` `npm run build-nolog` passed.
- `Architecture Decisions:` Решение оставлено узким: presentation overlay в NPC visual/runtime, trigger runtime только маршрутизирует `npc/set_emotion`, без universal VFX framework и без смешивания behavior/cutscene ownership.
- `Risks / Open Items:` Реализация остаётся TEMPORARY first-pass в presentation stub; second-pass может вынести Manpu в отдельный presentation layer без смены входных контрактов.
- `Next Recommended Step:` Выполнить короткий ручной smoke в runtime editor/level (`enter -> emotion`, `exit -> calm hide`) и при необходимости сделать только visual polish icons/timing.

### Entry
- `Date:` 2026-04-24
- `Task:` NPC Manpu Editor Authoring
- `Status:` done
- `Summary:` Добавлен полный designer-facing authoring для Manpu без смены архитектуры: NPC initial emotion в inspector, trigger volume npc/set_emotion с dropdown target/value, sequence `set_emotion` с canonical dropdown, и прямой cutscene step `set_emotion` (actor-local synchronous apply). Добавлен единый source-of-truth опций Manpu в `npc_manpu.ts`; runtime cutscene path не получил отдельный VFX ownership и не переписывался.
- `Files:`
  - `src/game/npc/npc_manpu.ts`
  - `src/game/npc/npc_types.ts`
  - `src/game/npc/npc_runtime.ts`
  - `src/game/world/runtime/test_world_config_validation.ts`
  - `src/game/world/runtime/test_world_editor_adapters.ts`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `src/game/world/runtime/test_world_runtime.ts`
  - `src/game/cutscene/cutscene_types.ts`
  - `src/game/cutscene/test_cutscene_registry.ts`
  - `src/scenes/runtime/test_cutscene_runtime.ts`
  - `src/game/cutscene/data/test_cutscenes.json`
  - `src/game/world/runtime/data/levels/test_world_level_01.json`
  - `docs/canon/the_form_mini_spec_npc_manpu_emotions_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
- `Manual Check:` запущен `npm run build-nolog`.
- `Architecture Decisions:` Cutscene `set_emotion` выполняется через world->npc actor-local API (`dispatchCutsceneSetEmotion`), без sequence-wrapper workaround и без отдельного cutscene VFX path.
- `Risks / Open Items:` Manpu presentation остаётся в TEMPORARY stub (`npc_visuals`/`npc_runtime`), что соответствует текущему first-pass contract.
- `Next Recommended Step:` Прогнать короткий ручной smoke в editor: NPC initial, trigger enter/exit, sequence action dropdown, cutscene direct step.

### Entry
- `Date:` 2026-04-24
- `Task:` Editor Authoring Workspace Split (canon patch)
- `Status:` done
- `Summary:` Добавлен новый mini spec `the_form_mini_spec_editor_authoring_workspace_ru.md` для канонического разделения runtime editor на два authoring workspace: `F2 / Level Editor` и `Logic Editor`. Зафиксировано, что F2 остаётся зоной placement/geometry/basic props/references, а trigger/cutscene/NPC behavior/flags authoring выносится в отдельное logic menu. Закреплены ownership/guardrails: logic editor правит только данные, runtime execution остаётся в существующих runtime slices, без giant controller/node graph/scripting/Unity migration. Миграционный контракт требует сохранить legacy trigger commands и draft/localStorage flow без потери данных.
- `Files:`
  - `docs/canon/the_form_mini_spec_editor_authoring_workspace_ru.md`
  - `docs/canon/the_form_orchestrator_state_ru.md`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` Сверены формулировки с source-of-truth документами по Event Authoring Foundation, Cutscene Vocabulary, NPC/Actor ownership и demo orchestration. Из-за существующих encoding искажений в части canon-файлов применён только append/minimal patch без полного rewrite.
- `Architecture Decisions:` Принят двухрабочий editor contract: `where is the thing?` остаётся в F2, `what happens?` уходит в Logic menu; first full implementation target — только `Logic > Triggers`.
- `Risks / Open Items:` Нужен аккуратный UX bridge между F2 inspector и Logic menu, чтобы не задублировать authoring surfaces в переходный период. Требуется проверка, что перенос UI не ломает legacy `enterCommand/exitCommand` и существующие draft'ы.
- `Next Recommended Step:` Начать implementation pass с shell-меню `Logic` и вкладки `Triggers`, переиспользовать текущие Event Blocks editors, затем облегчить F2 inspector до summary+deep links.

### Entry
- `Date:` 2026-04-24
- `Task:` Logic Workspace First Pass (runtime editor UX)
- `Status:` done
- `Summary:` В runtime editor добавлен отдельный workspace `Logic` с внутренними tabs `Triggers/Cutscenes/NPC Behavior/Flags`. Полный authoring Trigger Event Blocks вынесен в `Logic > Triggers` через переиспользование существующего helper `buildTriggerEventEditorSections(...)` и существующего mutation path. Trigger inspector в F2 облегчен: сохранены placement/geometry и legacy commands, добавлены Event Blocks summary и рабочий deep-link `Open in Logic`. Добавлен dev breadcrumb `Logic Editor / Triggers` и console marker `[editor] Logic > Triggers mounted`.
- `Files:`
  - `src/game/world/runtime/test_world_editor_sidebar.ts`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `docs/canon/the_form_mini_spec_editor_authoring_workspace_ru.md`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` `npm run build-nolog` passed. Проверен активный editor path: Event Blocks UI ранее рендерился только в `Inspector` tab для selected `triggerVolume`, что могло быть неочевидно пользователю.
- `Architecture Decisions:` Logic workspace добавлен как расширение текущего sidebar/editor, без нового editor application и без runtime rewrite. Legacy `enterCommand/exitCommand` и existing draft/localStorage flow сохранены.
- `Risks / Open Items:` Cutscenes/NPC Behavior/Flags в Logic workspace пока placeholders (кроме flags debug snapshot). Для полного переноса authoring UX возможно потребуется дополнительный polish trigger list labels/filters.
- `Next Recommended Step:` Следующий pass выбрать из трёх направлений: widen actor_action runtime support, Cutscene 2.0, NPC Behavior Pages.

### Entry
- `Date:` 2026-04-24
- `Task:` World Logic Rules / Event Listeners layer
- `Status:` done
- `Summary:` Added `World Logic Rules` as world-level listener layer over Event Authoring Foundation with new `Logic > Rules` authoring tab, runtime dispatch API, and rule execution through existing Event Actions runtime. `Logic > Triggers` remains intact as separate spatial authoring tab. Runtime now emits/matches `object_state_changed`, `trigger_event`, `npc_event`, and `cutscene_finished` events for rules.
- `Files:`
  - `docs/canon/the_form_mini_spec_world_logic_rules_ru.md`
  - `src/game/events/test_world_logic_rules.ts`
  - `src/game/world/runtime/test_world_config.ts`
  - `src/game/world/runtime/test_world_config_validation.ts`
  - `src/game/world/runtime/test_world_runtime.ts`
  - `src/game/world/runtime/test_world_editor_sidebar.ts`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `src/game/world/runtime/test_world_logic_rules_editor.ts`
  - `src/game/world/runtime/data/levels/test_world_level_01.json`
  - `src/scenes/runtime/test_cutscene_runtime.ts`
- `Manual Check:` `npm run build-nolog`.
- `Architecture Decisions:` Rules execution reuses existing Event Conditions/Actions; no giant controller/node graph/arbitrary script introduced.
- `Risks / Open Items:` `npc_event` currently piggybacks on `pf:npc_actor_action_event`; source filtering excludes synthetic `trigger_runtime` actor id.
- `Next Recommended Step:` Extend object state emitters beyond triangle break wall where additional object state transitions exist.

### Entry
- `Date:` 2026-04-24
- `Task:` F2 / Level Editor cleanup pass (placement-only focus)
- `Status:` done
- `Summary:` F2 inspector reduced to placement/basic editing. Trigger Volume inspector now keeps geometry/basic trigger refs + compact logic summary and `Open in Logic`; full nested logic authoring stays in `Logic > Triggers`. NPC inspector now keeps placement/profile/basic summary and `Open in Logic / NPC Behavior` placeholder. No legacy/event/rules data deletion introduced.
- `Files:`
  - `src/game/world/runtime/test_world_editor_runtime.ts`
  - `src/game/world/runtime/test_world_logic_rules_editor.ts`
  - `src/game/world/runtime/test_world_editor_sidebar.ts`
  - `docs/canon/the_form_mini_spec_editor_authoring_workspace_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
- `Manual Check:` planned `npm run build-nolog`.
- `Architecture Decisions:` no runtime gameplay rewrite; cleanup remains UI/authoring-surface change.
- `Risks / Open Items:` `Logic > NPC Behavior` still placeholder tab by design.
- `Next Recommended Step:` manual smoke for F2->Logic deep-links and scroll stability in long panels.
