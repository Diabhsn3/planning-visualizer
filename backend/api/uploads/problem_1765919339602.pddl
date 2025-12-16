(define (problem depot-hard-1)
  (:domain depot)

  (:objects
    t1 t2 - truck
    c1 c2 c3 c4 - package
    d1 d2 s1 s2 - location
  )

  (:init
    ;; Trucks start in different depots
    (at t1 d1)
    (at t2 d2)

    ;; Packages are split across depots
    (at c1 d1)
    (at c2 d1)
    (at c3 d2)
    (at c4 d2)
  )

  (:goal
    (and
      ;; Mix goals so trucks need to move + load/unload multiple times
      (at c1 s1)
      (at c2 s2)
      (at c3 s1)
      (at c4 s2)
    )
  )
)
