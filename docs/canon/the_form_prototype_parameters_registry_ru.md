# The Form — Prototype Parameters Registry

Статус: canonical draft  
Дата: 2026-03-25

## 1. Назначение документа
Этот документ фиксирует реестр параметров нового прототипа `The Form`.

Его задача:
- перечислить параметры, которые должны быть доступны для настройки;
- задать понятные, геймдизайнерские единицы измерения;
- отделить `design-facing parameters` от скрытых технических величин;
- не допустить возврата к hardcoded-настройкам.

Если в будущем конкретные стартовые значения изменятся, это не меняет структуру реестра: сам реестр является каноничным, а числа могут тюниться.

---

## 2. Общие правила параметризации

### 2.1. Что считается обязательным правилом
Все ключевые тайминги, силы, расстояния и лимиты прототипа должны задаваться параметрами.

### 2.2. Как параметры должны выглядеть
Параметры должны быть описаны в понятных единицах:
- время — в секундах;
- расстояние — в пикселях или тайлах;
- скорость — в пикселях в секунду;
- ускорение/замедление — в пикселях в секунду в секунду;
- углы — в градусах;
- заряд/ресурс — в сегментах, процентах или длине следа;
- вес формы — в явной игровой величине, а не в абстрактном коэффициенте без смысла.

### 2.3. Что запрещено
Не считаются хорошим каноном:
- скрытые магические числа;
- параметры без единиц измерения;
- параметры, смысл которых нельзя объяснить дизайнеру;
- дублирующие параметры, описывающие одно и то же разными именами.

### 2.4. Слои параметров
Параметры делятся на два слоя:

1. **Design-facing** — те, что можно объяснить через ощущение игры.
2. **Technical-supporting** — те, что нужны для реализации, но не должны подменять игровые решения.

Для первого прототипа приоритет у design-facing слоя.

---

## 3. Глобальные параметры прототипа

### 3.1. Общие системные тайминги
Обязательные параметры:
- `jump_buffer_time_sec` — окно buffer input для прыжка;
- `attach_buffer_time_sec` — окно buffer input для attach Square;
- `coyote_time_sec` — время кайота для форм, где есть обычный jump;
- `death_pause_time_sec` — длительность паузы перед респавном;
- `form_transform_time_sec` — длительность трансформации между формами;
- `wind_update_blend_time_sec` — насколько быстро форма ощущает изменение ветра, если нужен сглаженный отклик.

### 3.2. Общие параметры движения
- `ground_move_speed_px_per_sec` — базовая скорость по земле;
- `ground_accel_px_per_sec2` — ускорение по земле;
- `ground_decel_px_per_sec2` — торможение по земле;
- `air_control_speed_px_per_sec` — максимальная управляемая добавка в воздухе;
- `air_control_accel_px_per_sec2` — скорость набора управления в воздухе;
- `gravity_px_per_sec2` — базовая гравитация;
- `fall_speed_cap_px_per_sec` — предел скорости падения.

### 3.3. Marker / точка приложения
- `marker_move_speed_px_per_sec` — скорость движения marker внутри фигуры;
- `marker_return_speed_px_per_sec` — скорость возврата marker к центру без ввода;
- `marker_max_offset_px` — максимальное смещение marker от центра фигуры;
- `marker_smoothing_time_sec` — инерционность marker;
- `marker_visual_scale` — визуальный размер marker.

### 3.4. Вес форм
Так как вес фигур является частью игрового канона, он должен существовать как явный набор параметров:
- `ball_weight_value`
- `triangle_weight_value`
- `square_weight_value`

Эти параметры затем используются в системах вроде wind и, при необходимости, в других взаимодействиях.

---

## 4. Параметры Ball

### 4.1. Обычное движение Ball
- `ball_ground_speed_px_per_sec`
- `ball_ground_accel_px_per_sec2`
- `ball_ground_decel_px_per_sec2`
- `ball_air_control_speed_px_per_sec`
- `ball_air_control_accel_px_per_sec2`
- `ball_normal_jump_height_px` — первая высота прыжка;
- `ball_jump_hold_time_sec` — сколько удержание влияет на высоту обычного jump;
- `ball_jump_release_gravity_multiplier` — насколько сильнее форма начинает терять подъём после отпускания прыжка.

### 4.2. Ускорение Ball
- `ball_boost_start_impulse_px_per_sec` — стартовый импульс при активации `K`;
- `ball_boost_hold_speed_px_per_sec` — скорость при удерживаемом ускорении;
- `ball_boost_accel_px_per_sec2` — скорость добора до удерживаемого ускорения;
- `ball_boost_decel_px_per_sec2` — скорость замедления после завершения ускорения;
- `ball_boost_min_ground_contact_time_sec` — если понадобится минимальный надёжный контакт с землёй;
- `ball_boost_turn_resistance` — насколько тяжело менять направление в активном ускорении;
- `ball_boost_jump_velocity_multiplier` — небольшой множитель высоты boosted jump (должен оставаться близко к 1);
- `ball_boost_jump_min_horizontal_speed_px_per_sec` — минимальная горизонтальная скорость вылета boosted jump;
- `ball_boost_air_control_factor` — доля обычного air-control при удержании `K` в воздухе;
- `ball_boost_air_no_input_inertia_damping_per_sec` — затухание инерции Ball в воздухе при удержании `K`.

### 4.3. Rebound Ball
- `ball_rebound_input_window_sec` — окно, в которое прощается ранний повторный `Jump`;
- `ball_rebound_hit_pause_sec` — длительность hit pause при успешном rebound;
- `ball_rebound_level1_height_px` — первая высота прыжка с поверхности;
- `ball_rebound_level2_height_px` — усиленная высота rebound-chain;
- `ball_rebound_wall_assist_upward_px_per_sec` — вертикальная коррекция rebound от стены;
- `ball_rebound_floor_reflect_ratio`
- `ball_rebound_ceiling_reflect_ratio`
- `ball_rebound_wall_reflect_ratio`
- `ball_rebound_wall_coyote_time_sec` — окно wall-coyote для rebound от стен;
- `ball_rebound_pause_before_launch_sec` — пауза перед стартом wall/ceiling rebound;
- `ball_rebound_surface_input_lock_time_sec` — окно блокировки ввода в сторону поверхности после wall rebound;
- `ball_rebound_wall_min_into_surface_speed_px_per_sec` — порог «выраженной входящей скорости» для wall reflection;
- `ball_rebound_wall_fallback_upward_bias` — слабая вертикальная поправка fallback-отскока от стены;
- `ball_rebound_wall_min_exit_speed_px_per_sec` — минимум итоговой скорости wall rebound;
- `ball_rebound_ceiling_min_exit_speed_px_per_sec` — минимум итоговой скорости ceiling rebound;
- `ball_rebound_ceiling_min_downward_speed_px_per_sec` — минимум вертикальной скорости вниз после ceiling rebound;
- `ball_rebound_wall_steer_perpendicular_strength_multiplier` — множитель силы при steering-перпендикуляре от стены;
- `ball_rebound_wall_steer_diagonal_angle_deg` — угол steering-диагонали от нормали стены;
- `ball_rebound_wall_steer_vertical_angle_deg` — угол steering для `W/S` от нормали стены.

Если позже потребуется ограничить runaway-сценарии, это делается через отдельный канонический параметр, а не через скрытые clamp-и.

---

## 5. Параметры Triangle

### 5.1. Обычное перемещение Triangle
- `triangle_ground_speed_px_per_sec`
- `triangle_ground_accel_px_per_sec2`
- `triangle_ground_decel_px_per_sec2`
- `triangle_air_control_speed_px_per_sec`
- `triangle_air_control_accel_px_per_sec2`
- `triangle_gravity_px_per_sec2`

### 5.2. Специальный jump Triangle
Triangle не использует обычный jump как Ball и Square.

Обязательные параметры:
- `triangle_jump_turn_time_sec` — длительность начального разворота перед отталкиванием;
- `triangle_jump_launch_speed_px_per_sec` — стартовая скорость отталкивания;
- `triangle_jump_launch_angle_deg` — если понадобится канонический базовый угол старта;
- `triangle_jump_landing_align_time_sec` — время, за которое Triangle приходит к устойчивому положению на грани после падения.

### 5.3. Freeze Triangle
- `triangle_freeze_enter_time_sec` — время входа в freeze;
- `triangle_freeze_max_duration_sec` — максимум, сколько можно удерживать freeze;
- `triangle_freeze_turn_speed_deg_per_sec` — скорость поворота к новому направлению во freeze;
- `triangle_freeze_gravity_suppression_ratio` — насколько freeze гасит падение;
- `triangle_freeze_exit_time_sec`

### 5.4. Dash Triangle
- `triangle_dash_speed_px_per_sec`
- `triangle_dash_duration_sec`
- `triangle_dash_enter_time_sec`
- `triangle_dash_exit_time_sec`
- `triangle_dash_breakable_impact_min_speed_px_per_sec` — порог для пролома breakable-объекта;
- `triangle_dash_nonbreakable_stick_time_sec` — время фиксации углом в непробиваемой поверхности, если нужна отдельная фаза до `Jump`;
- `triangle_dash_post_release_fall_align_time_sec` — время стабилизации после отскока из stuck-состояния.

### 5.5. Charges Triangle
- `triangle_max_charges` = 3;
- `triangle_regen_channel_time_sec` — длительность подготовки к мгновенному восстановлению зарядов;
- `triangle_regen_allowed_only_grounded` — булевый контракт;
- `triangle_regen_interrupt_on_move` — если понадобится правило прерывания;
- `triangle_regen_interrupt_on_damage`

---

## 6. Параметры Square

### 6.1. Обычное движение Square
- `square_ground_speed_px_per_sec`
- `square_ground_accel_px_per_sec2`
- `square_ground_decel_px_per_sec2`
- `square_air_control_speed_px_per_sec`
- `square_air_control_accel_px_per_sec2`
- `square_normal_jump_height_px`
- `square_jump_hold_time_sec`
- `square_jump_release_gravity_multiplier`

### 6.2. Attach
- `square_attach_acquire_range_px` — допустимая дистанция для attach к валидной поверхности;
- `square_attach_acquire_buffer_time_sec` — окно forgiving attach input;
- `square_attach_snap_time_sec` — если attach требует короткой подстройки к поверхности;
- `square_attach_move_speed_px_per_sec` — скорость движения по поверхности;
- `square_attach_turn_corner_entry_range_px` — зона, в которой начинается проверка rollover;
- `square_attach_release_time_sec` — если понадобится мягкий выход из attach.

### 6.3. Trail resource
- `square_trail_max_length_px` — полный общий запас trail;
- `square_trail_spend_per_px` — расход trail за 1 пиксель пути;
- `square_trail_visual_thickness_px`
- `square_trail_ui_segment_count`
- `square_trail_auto_regen_speed_px_per_sec` — скорость автоматического возврата trail вне attach;
- `square_trail_manual_regen_speed_px_per_sec` — скорость ручного восстановления по `O`;
- `square_trail_regen_start_delay_sec`
- `square_trail_stop_regen_on_attach` = true.

### 6.4. Attach-jump
- `square_attach_jump_height_px` — фиксированная уменьшенная высота прыжка;
- `square_attach_jump_out_speed_px_per_sec` — скорость отрыва перпендикулярно поверхности;
- `square_attach_jump_return_time_sec` — длительность возврата к trail;
- `square_attach_jump_tether_stretch_px` — визуальная/игровая длина натяжения связи;
- `square_attach_jump_release_detach` = true.

### 6.5. Rollover
- `square_rollover_preview_time_sec` — если preview имеет минимальную длительность;
- `square_rollover_duration_sec`
- `square_rollover_return_time_sec` — время обратного возврата, если новая поверхность невалидна;
- `square_rollover_corner_detection_range_px`
- `square_rollover_surface_validation_range_px`

### 6.6. Moving attach surfaces
- `square_attach_surface_follow_tolerance_px`
- `square_attach_jump_return_surface_reacquire_range_px`

---

## 7. Параметры form switching
- `form_switch_lock_time_sec`
- `form_switch_vfx_time_sec` — даже если эффекты пока минимальны;
- `form_switch_cancel_on_no_space` = true;
- `form_switch_keep_velocity_default` = true;
- `form_switch_keep_marker_position_default` = true.

State-specific exceptions при этом живут в каноне форм, а не в общем реестре.

---

## 8. Параметры камеры
- `camera_deadzone_width_px`
- `camera_deadzone_height_px`
- `camera_follow_lerp_time_sec`
- `camera_bias_down_px`
- `camera_bias_forward_px` — если понадобится лёгкий сдвиг по движению;
- `camera_snap_threshold_px`
- `camera_scene_edge_softness_px`

---

## 9. Параметры wind
Так как ветер действует по-разному на формы, он должен иметь и общие, и форм-специфические параметры.

### 9.1. Общие параметры wind zone
- `wind_force_px_per_sec2`
- `wind_direction_deg`
- `wind_fall_in_distance_px` — плавный вход в область ветра;
- `wind_fall_out_distance_px` — плавный выход;
- `wind_visual_strength`

### 9.2. Модификаторы по формам
- `wind_ball_multiplier`
- `wind_triangle_multiplier`
- `wind_square_multiplier`
- `wind_square_attach_multiplier` = 0
- `wind_triangle_dash_multiplier`

---

## 10. Параметры checkpoint / death / hazard
- `hazard_contact_kill` = true;
- `death_pause_time_sec`
- `respawn_snap_time_sec`
- `checkpoint_activate_time_sec`
- `checkpoint_visual_feedback_time_sec`

---

## 11. Параметры breakable и платформ

### 11.1. Breakable
- `breakable_break_time_sec`
- `breakable_destroy_vfx_time_sec`
- `breakable_reacts_only_to_triangle_dash` = true.

### 11.2. Moving platform
- `moving_platform_speed_px_per_sec`
- `moving_platform_wait_time_sec`
- `moving_platform_path_length_px`

### 11.3. overlap zone platform
- `trigger_platform_activation_delay_sec`
- `trigger_platform_move_speed_px_per_sec`
- `trigger_platform_return_delay_sec`

---

## 12. Параметры UI
### 12.1. Нижний правый UI формы
- `ui_form_panel_margin_x_px`
- `ui_form_panel_margin_y_px`
- `ui_form_icon_size_px`
- `ui_form_switch_hint_gap_px`

### 12.2. Верхний ресурсный UI
- `ui_resource_panel_margin_top_px`
- `ui_resource_panel_gap_px`
- `ui_triangle_charge_icon_size_px`
- `ui_square_trail_bar_width_px`
- `ui_square_trail_bar_height_px`
- `ui_square_trail_segment_count`

### 12.3. Debug UI
- `debug_ui_enabled_default`
- `debug_ui_panel_margin_px`
- `debug_marker_visibility`
- `debug_collision_overlay_visibility`

---

## 13. Что требует дальнейшего уточнения
На уровне реестра уже видны места, где в будущем возможно уточнение:
- точный набор глобальных и form-specific скоростей;
- нужно ли отдельное разделение ground friction по формам;
- требуется ли отдельная параметризация поворота Triangle на земле и в воздухе;
- нужен ли Square отдельный лимит на длину одного непрерывного attach-сегмента, кроме общего trail;
- нужны ли Ball отдельные параметры «степени распрыга» beyond level1/level2.

Эти вопросы не отменяют канон реестра, а лишь помечают следующий слой детализации.

---

## 14. Правило сопровождения документа
При добавлении новой механики сначала должен обновляться этот реестр, а потом уже реализация.

Нельзя делать так, чтобы новая система сначала появлялась в логике, а параметризация добавлялась задним числом.
