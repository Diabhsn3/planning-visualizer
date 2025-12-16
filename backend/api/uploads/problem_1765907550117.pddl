(define (problem depot-default)
  (:domain depot)
  (:objects
    truck1 - truck
    package1 package2 - package
    depot1 distributor1 - location
  )
  (:init
    (at truck1 depot1)
    (at package1 depot1)
    (at package2 depot1)
  )
  (:goal
    (and
      (at package1 distributor1)
      (at package2 distributor1)
    )
  )
)