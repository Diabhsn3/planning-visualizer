(define (problem satellite-p1)
  (:domain satellite)

  (:objects
    s1 - satellite
    i1 - instrument
    dcal d1 - direction
    m1 - mode
    g1 - groundstation
  )

  (:init
    ;; instrument mounted on satellite
    (on-board i1 s1)

    ;; instrument capabilities
    (supports i1 m1)

    ;; satellite initially pointing at calibration direction
    (pointing s1 dcal)

    ;; instrument already powered on
    (power-on i1)

    ;; visibility + link
    (visible d1 g1)
    (link-available g1)
  )

  (:goal
    (and
      (downlinked d1 m1 g1)
    )
  )
)
