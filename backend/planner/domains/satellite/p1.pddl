(define (problem satellite-p1)
  (:domain satellite)

  (:objects
    s1 - satellite
    i1 - instrument
    t1 - target
    dcal d1 - direction
    g1 - groundstation
  )

  (:init
    ;; instrument mounted on satellite
    (onboard i1 s1)

    ;; instrument capabilities + calibration target
    (supports i1 t1)
    (calibration-target i1 t1)

    ;; REQUIRED: Link target to its direction
    (target-dir t1 d1)

    ;; satellite initially pointing at calibration direction
    (pointing s1 dcal)

    ;; resources
    (power-avail s1)
    (storage-avail s1)

    ;; visibility for transmission
    (visible s1 g1)
  )

  (:goal
    (and
      (have-image t1)
    )
  )
)
