(define (problem rovers-p1)
  (:domain rovers)

  (:objects
    r1 - rover
    w1 w2 - waypoint
    t1 - target
  )

  (:init
    ;; rover starts at w1
    (at-rover r1 w1)

    ;; map graph
    (connected w1 w2)
    (connected w2 w1)

    ;; target is at w2
    (at-target t1 w2)
  )

  (:goal
    (and
      (communicated t1)
    )
  )
)
