(define (problem depot-p1)
  (:domain depot)

  (:objects
      d1 - depot
      s1 - distributor
      t1 - truck
      c1 - package
  )

  (:init
      (at c1 d1)
      (at-truck t1 d1)
  )

  (:goal
      (and
        (at c1 s1)
      )
  )
)
