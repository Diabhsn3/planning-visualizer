(define (problem p11)
  (:domain depot)

  (:objects
      d1 d2 - depot
      t1 - truck
      c1 c2 - crane
      p1 p2 - package
      pile1 pile2 - pile
  )

  (:init
      ;; truck starts at d1
      (at-truck t1 d1)

      ;; cranes
      (at-crane c1 d1)
      (empty-crane c1)
      (at-crane c2 d2)
      (empty-crane c2)

      ;; piles at depots
      ;; p2 is buried under p1 at d1
      (on p1 p2)
      (on-pile p2 pile1)
      (clear p1)
      (clear pile2)

      ;; pile1 not clear because p2 is on it
      ;; pile2 empty and clear
  )

  ;; Goal: move p2 to d2 on pile2
  (:goal
      (on-pile p2 pile2)
  )
)
