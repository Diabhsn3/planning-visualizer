(define (problem depot-simple)
  (:domain depot)

  (:objects
      d1 d2 - depot
      t1 - truck
      c1 c2 - crane
      pile1 pile2 - pile
      p1 p2 - package
  )

  (:init
      (at-truck t1 d1)

      (at-crane c1 d1)
      (empty-crane c1)
      (at-crane c2 d2)
      (empty-crane c2)

      (on-pile p2 pile1)
      (on p1 p2)

      (clear p1)
      (clear pile2)
  )

  (:goal
      (on-pile p2 pile2)
  )
)
