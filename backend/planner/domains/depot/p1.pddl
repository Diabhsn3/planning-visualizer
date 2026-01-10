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

      ;; cranes at their depots
      (at-crane c1 d1)
      (empty-crane c1)
      (at-crane c2 d2)
      (empty-crane c2)

      ;; pile locations - pile1 at d1, pile2 at d2
      (at-pile pile1 d1)
      (at-pile pile2 d2)

      ;; packages stacked: p1 on top of p2, p2 on pile1
      (on p1 p2)
      (on-pile p2 pile1)
      (clear p1)
      (clear pile2)

      ;; Note: pile1 is not clear because p2 is on it
  )

  ;; Goal: move p2 to pile2 at d2
  (:goal
      (on-pile p2 pile2)
  )
)
