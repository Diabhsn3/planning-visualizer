(define (problem rover-problem-complex)
  (:domain rover)

  (:objects
    rover1 rover2 - rover
    lander0 - lander

    a b c d e f g - waypoint

    cam1 cam2 - camera
    obj1 obj2 obj3 - objective

    high_res low_res colour - mode
  )

  (:init
    ;; ===== LOCATIONS =====
    (at rover1 a)
    (at rover2 d)
    (at lander0 c)

    ;; ===== NAVIGATION GRAPH =====
    (can_traverse rover1 a b)
    (can_traverse rover1 b c)
    (can_traverse rover1 c e)
    (can_traverse rover1 e f)

    (can_traverse rover2 d c)
    (can_traverse rover2 c b)
    (can_traverse rover2 b g)

    ;; ===== VISIBILITY =====
    (visible a obj1)
    (visible b obj1)
    (visible c obj2)
    (visible e obj3)
    (visible g obj3)

    ;; ===== SAMPLES =====
    (at_rock_sample b)
    (at_rock_sample f)

    (at_soil_sample e)
    (at_soil_sample g)

    ;; ===== ROVER CAPABILITIES =====
    (equipped_for_rock_analysis rover1)
    (equipped_for_soil_analysis rover2)

    ;; ===== STORAGE =====
    (store_of rover1 rover1store)
    (store_of rover2 rover2store)
    (empty rover1store)
    (empty rover2store)

    ;; ===== CAMERAS =====
    (on_board cam1 rover1)
    (on_board cam2 rover2)

    (calibration_target cam1 obj1)
    (calibration_target cam2 obj3)

    (supports cam1 high_res)
    (supports cam1 colour)

    (supports cam2 low_res)
    (supports cam2 colour)

    ;; ===== INITIAL CAMERA STATE =====
    (available rover1)
    (available rover2)
  )

  (:goal
    (and
      ;; ===== DATA TRANSMISSION =====
      (communicated_rock_data b)
      (communicated_rock_data f)

      (communicated_soil_data e)
      (communicated_soil_data g)

      ;; ===== IMAGES =====
      (communicated_image_data obj1 high_res)
      (communicated_image_data obj2 colour)
      (communicated_image_data obj3 low_res)
    )
  )
)
